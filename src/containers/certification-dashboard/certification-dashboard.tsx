import { t } from '@lingui/macro';
import {
  Button,
  ButtonVariant,
  DropdownItem,
  Label,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  DownloadIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from '@patternfly/react-icons';
import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  CertificateUploadAPI,
  CollectionAPI,
  CollectionVersion,
  CollectionVersionAPI,
  CollectionVersionSearch,
  RepoHrefToDistroType,
  Repositories,
  RepositoryDistributionsAPI,
} from 'src/api';
import {
  BaseHeader,
  DateComponent,
  EmptyStateFilter,
  EmptyStateNoData,
  EmptyStateUnauthorized,
  ListItemActions,
  Main,
} from 'src/components';
import {
  AlertList,
  AlertType,
  AppliedFilters,
  CompoundFilter,
  LoadingPageSpinner,
  LoadingPageWithHeader,
  Pagination,
  SortTable,
  UploadSingCertificateModal,
  closeAlertMixin,
} from 'src/components';
import { Constants } from 'src/constants';
import { AppContext } from 'src/loaders/app-context';
import { Paths, formatPath } from 'src/paths';
import { RouteProps, withRouter } from 'src/utilities';
import {
  ParamHelper,
  errorMessage,
  filterIsSet,
  parsePulpIDFromURL,
  waitForTask,
} from 'src/utilities';
import './certification-dashboard.scss';

interface IState {
  params: {
    certification?: string;
    namespace?: string;
    collection?: string;
    page?: number;
    page_size?: number;
    status?: string;
    sort?: string;
  };
  alerts: AlertType[];
  versions: CollectionVersion[];
  itemCount: number;
  loading: boolean;
  updatingVersions: CollectionVersionSearch['collection_version'][];
  unauthorized: boolean;
  inputText: string;
  uploadCertificateModalOpen: boolean;
  versionToUploadCertificate?: CollectionVersionSearch['collection_version'];
  repoHrefToDistro: RepoHrefToDistroType;
}

class CertificationDashboard extends React.Component<RouteProps, IState> {
  constructor(props) {
    super(props);

    const params = ParamHelper.parseParamString(props.location.search, [
      'page',
      'page_size',
    ]);

    if (!params['page_size']) {
      params['page_size'] = 10;
    }

    if (!params['sort']) {
      params['sort'] = '-pulp_created';
    }

    if (!params['status']) {
      params['status'] = Constants.NEEDSREVIEW;
    }

    this.state = {
      versions: undefined,
      itemCount: 0,
      params: params,
      loading: true,
      updatingVersions: [],
      alerts: [],
      unauthorized: false,
      inputText: '',
      uploadCertificateModalOpen: false,
      versionToUploadCertificate: null,
      repoHrefToDistro: {},
    };
  }

  componentDidMount() {
    const { user, hasPermission } = this.context;
    if (
      !user ||
      user.is_anonymous ||
      !hasPermission('ansible.modify_ansible_repo_content')
    ) {
      this.setState({ unauthorized: true });
    } else {
      this.queryCollections();
    }
  }

  render() {
    const { versions, params, itemCount, loading, unauthorized } = this.state;
    if (!versions && !unauthorized) {
      return <LoadingPageWithHeader></LoadingPageWithHeader>;
    }

    return (
      <React.Fragment>
        <BaseHeader title={t`Approval dashboard`}></BaseHeader>
        <AlertList
          alerts={this.state.alerts}
          closeAlert={(i) => this.closeAlert(i)}
        />
        {unauthorized ? (
          <EmptyStateUnauthorized />
        ) : (
          <Main className='hub-certification-dashboard'>
            <section className='body' data-cy='body'>
              <div className='toolbar hub-toolbar'>
                <Toolbar>
                  <ToolbarGroup>
                    <ToolbarItem>
                      <CompoundFilter
                        inputText={this.state.inputText}
                        onChange={(text) => {
                          this.setState({ inputText: text });
                        }}
                        updateParams={(p) =>
                          this.updateParams(p, () => this.queryCollections())
                        }
                        params={params}
                        filterConfig={[
                          {
                            id: 'namespace',
                            title: t`Namespace`,
                          },
                          {
                            id: 'name',
                            title: t`Collection Name`,
                          },
                          {
                            id: 'status',
                            title: t`Status`,
                            inputType: 'select',
                            options: [
                              {
                                id: Constants.NOTCERTIFIED,
                                title: t`Rejected`,
                              },
                              {
                                id: Constants.NEEDSREVIEW,
                                title: t`Needs Review`,
                              },
                              {
                                id: Constants.APPROVED,
                                title: t`Approved`,
                              },
                            ],
                          },
                        ]}
                      />
                    </ToolbarItem>
                  </ToolbarGroup>
                </Toolbar>

                <Pagination
                  params={params}
                  updateParams={(p) =>
                    this.updateParams(p, () => this.queryCollections())
                  }
                  count={itemCount}
                  isTop
                />
              </div>
              <div>
                <AppliedFilters
                  updateParams={(p) => {
                    this.updateParams(p, () => this.queryCollections());
                    this.setState({ inputText: '' });
                  }}
                  params={params}
                  ignoredParams={['page_size', 'page', 'sort']}
                  niceValues={{
                    status: {
                      [Constants.APPROVED]: t`Approved`,
                      [Constants.NEEDSREVIEW]: t`Needs Review`,
                      [Constants.NOTCERTIFIED]: t`Rejected`,
                    },
                  }}
                  niceNames={{
                    status: t`Status`,
                  }}
                />
              </div>
              {loading ? (
                <LoadingPageSpinner />
              ) : (
                this.renderTable(versions, params)
              )}

              <div className='footer'>
                <Pagination
                  params={params}
                  updateParams={(p) =>
                    this.updateParams(p, () => this.queryCollections())
                  }
                  count={itemCount}
                />
              </div>
            </section>
            <UploadSingCertificateModal
              isOpen={this.state.uploadCertificateModalOpen}
              onCancel={() => this.closeUploadCertificateModal()}
              onSubmit={(d) => this.submitCertificate(d)}
            />
          </Main>
        )}
      </React.Fragment>
    );
  }

  private renderTable(versions, params) {
    if (versions.length === 0) {
      return filterIsSet(params, ['namespace', 'name', 'repository']) ? (
        <EmptyStateFilter />
      ) : (
        <EmptyStateNoData
          title={t`No managed collections yet`}
          description={t`Collections will appear once uploaded`}
        />
      );
    }
    const sortTableOptions = {
      headers: [
        {
          title: t`Namespace`,
          type: 'alpha',
          id: 'namespace',
        },
        {
          title: t`Collection`,
          type: 'alpha',
          id: 'name',
        },
        {
          title: t`Version`,
          type: 'number',
          id: 'version',
        },
        {
          title: t`Date created`,
          type: 'number',
          id: 'pulp_created',
        },
        {
          title: t`Status`,
          type: 'none',
          id: 'status',
        },
        {
          title: '',
          type: 'none',
          id: 'certify',
        },
      ],
    };

    return (
      <table
        aria-label={t`Collection versions`}
        className='hub-c-table-content pf-c-table'
      >
        <SortTable
          options={sortTableOptions}
          params={params}
          updateParams={(p) =>
            this.updateParams(p, () => this.queryCollections())
          }
        />
        <tbody>
          {versions.map((version, i) => this.renderRow(version, i))}
        </tbody>
      </table>
    );
  }

  private renderStatus(collectionData: CollectionVersionSearch) {
    const { collection_version: version, repository } = collectionData;
    const repoStatus = repository.pulp_labels?.pipeline;

    if (this.state.updatingVersions.includes(version)) {
      return <span className='fa fa-lg fa-spin fa-spinner' />;
    }
    if (repoStatus === Constants.APPROVED) {
      const { display_signatures } = this.context.featureFlags;
      return (
        <Label variant='outline' color='green' icon={<CheckCircleIcon />}>
          {display_signatures && collectionData.is_signed
            ? t`Signed and approved`
            : t`Approved`}
        </Label>
      );
    }
    if (repoStatus === Constants.NOTCERTIFIED) {
      return (
        <Label variant='outline' color='red' icon={<ExclamationCircleIcon />}>
          {t`Rejected`}
        </Label>
      );
    }
    if (repoStatus === Constants.NEEDSREVIEW) {
      const { can_upload_signatures, require_upload_signatures } =
        this.context.featureFlags;
      return (
        <Label
          variant='outline'
          color='orange'
          icon={<ExclamationTriangleIcon />}
        >
          {!collectionData.is_signed &&
          can_upload_signatures &&
          require_upload_signatures
            ? t`Needs signature and review`
            : t`Needs review`}
        </Label>
      );
    }
  }

  private renderRow(collectionData: CollectionVersionSearch, index) {
    const { collection_version: version, repository } = collectionData;
    const distroBasePath =
      this.state.repoHrefToDistro[repository.pulp_href]?.base_path;

    return (
      <tr key={index} data-cy='CertificationDashboard-row'>
        <td>{version.namespace}</td>
        <td>{version.name}</td>
        <td>
          {distroBasePath ? (
            <>
              <Link
                to={formatPath(
                  Paths.collectionByRepo,
                  {
                    namespace: version.namespace,
                    collection: version.name,
                    repo: distroBasePath,
                  },
                  {
                    version: version.version,
                  },
                )}
              >
                {version.version}
              </Link>
              <Button
                variant={ButtonVariant.link}
                onClick={() => {
                  this.download(
                    distroBasePath,
                    version.namespace,
                    version.name,
                    version.version,
                  );
                }}
              >
                <DownloadIcon />
              </Button>
            </>
          ) : (
            <>
              {version.version} <DownloadIcon />
            </>
          )}
        </td>
        <td>
          <DateComponent date={version.pulp_created} />
        </td>
        <td>{this.renderStatus(collectionData)}</td>
        {this.renderButtons(collectionData)}
      </tr>
    );
  }

  private renderButtons(collectionData: CollectionVersionSearch) {
    // not checking namespace permissions here, auto_sign happens API side, so is the permission check
    const { collection_version: version, repository } = collectionData;
    const {
      can_upload_signatures,
      collection_auto_sign,
      require_upload_signatures,
    } = this.context.featureFlags;
    if (this.state.updatingVersions.includes(version)) {
      return <ListItemActions />; // empty td;
    }

    const canUploadSignature =
      can_upload_signatures && !collectionData.is_signed;
    const mustUploadSignature = canUploadSignature && require_upload_signatures;
    const autoSign = collection_auto_sign && !require_upload_signatures;

    const approveButton = [
      canUploadSignature && (
        <React.Fragment key='upload'>
          <Button onClick={() => this.openUploadCertificateModal(version)}>
            {t`Upload signature`}
          </Button>{' '}
        </React.Fragment>
      ),
      <Button
        key='approve'
        isDisabled={mustUploadSignature}
        data-cy='approve-button'
        onClick={() =>
          this.updateCertification(
            version,
            Constants.NEEDSREVIEW,
            Constants.PUBLISHED,
          )
        }
      >
        {autoSign ? t`Sign and approve` : t`Approve`}
      </Button>,
    ].filter(Boolean);

    const importsLink = (
      <DropdownItem
        key='imports'
        component={
          <Link
            to={formatPath(
              Paths.myImports,
              {},
              {
                namespace: version.namespace,
                name: version.name,
                version: version.version,
              },
            )}
          >
            {t`View Import Logs`}
          </Link>
        }
      />
    );

    const certifyDropDown = (isDisabled: boolean, originalRepo) => (
      <DropdownItem
        onClick={() =>
          this.updateCertification(version, originalRepo, Constants.PUBLISHED)
        }
        isDisabled={isDisabled}
        key='certify'
      >
        {autoSign ? t`Sign and approve` : t`Approve`}
      </DropdownItem>
    );

    const rejectDropDown = (isDisabled: boolean, originalRepo) => (
      <DropdownItem
        onClick={() =>
          this.updateCertification(
            version,
            originalRepo,
            Constants.NOTCERTIFIED,
          )
        }
        isDisabled={isDisabled}
        className='rejected-icon'
        key='reject'
      >
        {t`Reject`}
      </DropdownItem>
    );

    const repoStatus = repository.pulp_labels?.pipeline;

    if (repoStatus === Constants.APPROVED) {
      return (
        <ListItemActions
          kebabItems={[
            certifyDropDown(true, Constants.PUBLISHED),
            rejectDropDown(false, Constants.PUBLISHED),
            importsLink,
          ]}
        />
      );
    }
    if (repoStatus === Constants.NOTCERTIFIED) {
      return (
        <ListItemActions
          kebabItems={[
            certifyDropDown(false, Constants.NOTCERTIFIED),
            rejectDropDown(true, Constants.NOTCERTIFIED),
            importsLink,
          ]}
        />
      );
    }
    if (repoStatus === Constants.NEEDSREVIEW) {
      return (
        <ListItemActions
          kebabItems={[
            rejectDropDown(false, Constants.NEEDSREVIEW),
            importsLink,
          ]}
          buttons={approveButton}
        />
      );
    }
  }

  private openUploadCertificateModal(
    version: CollectionVersionSearch['collection_version'],
  ) {
    this.setState({
      uploadCertificateModalOpen: true,
      versionToUploadCertificate: version,
    });
  }

  private closeUploadCertificateModal() {
    this.setState({
      uploadCertificateModalOpen: false,
      versionToUploadCertificate: null,
    });
  }

  private submitCertificate(file: File) {
    const version = this.state.versionToUploadCertificate;
    const signed_collection = version.pulp_href;

    return Repositories.getRepository({
      name: 'staging',
    })
      .then((response) =>
        CertificateUploadAPI.upload({
          file,
          repository: response.data.results[0].pulp_href,
          signed_collection,
        }),
      )
      .then((result) => waitForTask(parsePulpIDFromURL(result.data.task)))
      .then(() =>
        this.addAlert(
          t`Certificate for collection "${version.namespace} ${version.name} v${version.version}" has been successfully uploaded.`,
          'success',
        ),
      )
      .then(() => this.queryCollections())
      .catch((error) => {
        const description = !error.response
          ? error
          : errorMessage(error.response.status, error.response.statusText);

        this.addAlert(
          t`The certificate for "${version.namespace} ${version.name} v${version.version}" could not be saved.`,
          'danger',
          description,
        );
      })
      .finally(() => this.closeUploadCertificateModal());
  }

  private updateCertification(version, originalRepo, destinationRepo) {
    this.setState({ updatingVersions: [version] });

    return CollectionVersionAPI.setRepository(
      version.namespace,
      version.name,
      version.version,
      originalRepo,
      destinationRepo,
    )
      .then((result) =>
        waitForTask(result.data.remove_task_id, { waitMs: 500 }),
      )
      .then(() =>
        this.addAlert(
          t`Certification status for collection "${version.namespace} ${version.name} v${version.version}" has been successfully updated.`,
          'success',
        ),
      )
      .then(() => this.queryCollections())
      .catch((error) => {
        const description = !error.response
          ? error
          : errorMessage(error.response.status, error.response.statusText);

        this.addAlert(
          t`Changes to certification status for collection "${version.namespace} ${version.name} v${version.version}" could not be saved.`,
          'danger',
          description,
        );
      });
  }

  private queryCollections() {
    this.setState({ loading: true }, () => {
      const { status, sort, ...params } = this.state.params;

      const updatedParams = {
        order_by: sort,
        ...params,
      };

      if (status) {
        updatedParams['repository_label'] = `pipeline=${status}`;
      }

      CollectionVersionAPI.list(updatedParams)
        .then((result) => {
          this.setState({
            versions: result.data.data,
            itemCount: result.data.meta.count,
            loading: false,
            updatingVersions: [],
          });

          if (result.data.meta.count > 0) {
            RepositoryDistributionsAPI.queryDistributionsByRepositoryHrefs(
              {},
              result.data.data,
            )
              .then((repoHrefToDistro: RepoHrefToDistroType) => {
                this.setState({ repoHrefToDistro: repoHrefToDistro });
              })
              .catch((error) => {
                this.addAlert(
                  t`Error loading distributions.`,
                  'danger',
                  error?.message,
                );
                this.setState({ repoHrefToDistro: {} });
              });
          }
        })
        .catch((error) => {
          this.addAlert(
            t`Error loading collections.`,
            'danger',
            error?.message,
          );
          this.setState({
            loading: false,
            updatingVersions: [],
          });
        });
    });
  }

  private download(
    distroBasePath: string,
    namespace: string,
    name: string,
    version: string,
  ) {
    CollectionAPI.getDownloadURL(distroBasePath, namespace, name, version).then(
      (downloadURL: string) => {
        window.location.assign(downloadURL);
      },
    );
  }

  private get updateParams() {
    return ParamHelper.updateParamsMixin();
  }

  private get closeAlert() {
    return closeAlertMixin('alerts');
  }

  private addAlert(title, variant, description?) {
    this.setState({
      alerts: [
        ...this.state.alerts,
        {
          description,
          title,
          variant,
        },
      ],
    });
  }
}

export default withRouter(CertificationDashboard);

CertificationDashboard.contextType = AppContext;
