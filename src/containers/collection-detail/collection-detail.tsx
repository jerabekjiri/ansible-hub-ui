import { isEqual } from 'lodash';
import * as React from 'react';
import {
  CollectionAPI,
  CollectionVersionContentType,
  RepositoryDistributionsAPI,
  findDistroBasePathByRepo,
} from 'src/api';
import {
  AlertList,
  CollectionHeader,
  CollectionInfo,
  LoadingPageSpinner,
  LoadingPageWithHeader,
  Main,
  closeAlertMixin,
} from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths, formatPath, namespaceBreadcrumb } from 'src/paths';
import { RouteProps, withRouter } from 'src/utilities';
import { ParamHelper } from 'src/utilities/param-helper';
import { IBaseCollectionState, loadCollection } from './base';

interface IState extends IBaseCollectionState {
  content?: CollectionVersionContentType;
}

// renders collection level information
class CollectionDetail extends React.Component<RouteProps, IState> {
  constructor(props) {
    super(props);

    const params = ParamHelper.parseParamString(props.location.search);

    this.state = {
      collections: [],
      collection: null,
      content: null,
      distroBasePath: null,
      params: params,
      alerts: [],
    };
  }

  componentDidMount() {
    this.loadCollections(true);
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(prevProps.location, this.props.location)) {
      this.loadCollections(false);
    }
  }

  render() {
    const { collections, collection, distroBasePath, content, params, alerts } =
      this.state;

    if (collections.length <= 0) {
      return <LoadingPageWithHeader></LoadingPageWithHeader>;
    }

    const { collection_version: version, repository } = collection;

    const breadcrumbs = [
      namespaceBreadcrumb,
      {
        url: formatPath(Paths.namespaceByRepo, {
          namespace: version.namespace,
          repo: repository.name,
        }),
        name: version.namespace,
      },
      {
        name: version.name,
      },
    ];

    return (
      <React.Fragment>
        <AlertList
          alerts={alerts}
          closeAlert={(i) => this.closeAlert(i)}
        ></AlertList>
        <CollectionHeader
          reload={() => this.loadCollections(true)}
          collections={collections}
          collection={collection}
          content={content}
          params={params}
          updateParams={(p) =>
            this.updateParams(p, () => this.loadCollections(true))
          }
          breadcrumbs={breadcrumbs}
          activeTab='install'
          repo={this.context.selectedRepo}
        />
        <Main>
          <section className='body'>
            {!distroBasePath ? (
              <LoadingPageSpinner />
            ) : (
              <CollectionInfo
                {...collection}
                content={content}
                distroBasePath={distroBasePath}
                updateParams={(p) => this.updateParams(p)}
                params={this.state.params}
                addAlert={(variant, title, description) =>
                  this.setState({
                    alerts: [
                      ...this.state.alerts,
                      {
                        variant,
                        title,
                        description,
                      },
                    ],
                  })
                }
              />
            )}
          </section>
        </Main>
      </React.Fragment>
    );
  }

  private loadCollections(forceReload) {
    const { repo, ...routeParams } = this.props.routeParams;
    loadCollection({
      forceReload,
      matchParams: {
        repository_name: repo,
        ...routeParams,
      },
      navigate: this.props.navigate,
      selectedRepo: this.context.selectedRepo,
      setCollection: (collections, collection) => {
        this.setState({
          collections,
          collection,
        });
        this.queryDistribution(collection.repository);
      },
      stateParams: this.state.params,
    });
  }

  private queryDistribution(repository) {
    RepositoryDistributionsAPI.list({
      repository: repository.pulp_href,
    }).then((result) => {
      const distroBasePath = findDistroBasePathByRepo(
        result.data.results,
        repository,
      );
      this.setState({ distroBasePath });

      const { namespace, name, version } =
        this.state.collection.collection_version;
      CollectionAPI.getContent(distroBasePath, namespace, name, version).then(
        (res) => {
          this.setState({ content: res.data });
        },
      );
    });
  }

  get updateParams() {
    return ParamHelper.updateParamsMixin();
  }

  private get closeAlert() {
    return closeAlertMixin('alerts');
  }
}

export default withRouter(CollectionDetail);

CollectionDetail.contextType = AppContext;
