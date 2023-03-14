import { t } from '@lingui/macro';
import * as React from 'react';
import { CollectionAPI } from 'src/api';
import {
  CollectionContentList,
  CollectionHeader,
  LoadingPageWithHeader,
  Main,
} from 'src/components';
import { AppContext } from 'src/loaders/app-context';
import { Paths, formatPath, namespaceBreadcrumb } from 'src/paths';
import { RouteProps, withRouter } from 'src/utilities';
import { ParamHelper } from 'src/utilities/param-helper';
import { IBaseCollectionState, loadCollection } from './base';

interface IState extends IBaseCollectionState {
  contents: any;
}

// renders list of contents in a collection
class CollectionContent extends React.Component<RouteProps, IState> {
  constructor(props) {
    super(props);

    const params = ParamHelper.parseParamString(props.location.search);

    this.state = {
      collections: [],
      collection: null,
      contents: [],
      params: params,
    };
  }

  componentDidMount() {
    this.loadCollections(false);
  }

  render() {
    const { collections, collection, params, contents } = this.state;

    if (collections.length <= 0) {
      return <LoadingPageWithHeader></LoadingPageWithHeader>;
    }

    const { collection_version, repository } = collection;

    const breadcrumbs = [
      namespaceBreadcrumb,
      {
        url: formatPath(Paths.namespaceByRepo, {
          namespace: collection_version.namespace,
          repo: repository.name,
        }),
        name: collection_version.namespace,
      },
      {
        url: formatPath(Paths.collectionByRepo, {
          namespace: collection_version.namespace,
          collection: collection_version.name,
          repo: repository.name,
        }),
        name: collection_version.name,
      },
      { name: t`Content` },
    ];

    return (
      <React.Fragment>
        <CollectionHeader
          reload={() => this.loadCollections(true)}
          collections={collections}
          collection={collection}
          params={params}
          updateParams={(params) =>
            this.updateParams(params, () => this.loadCollections(true))
          }
          breadcrumbs={breadcrumbs}
          activeTab='contents'
          repo={this.context.selectedRepo}
        />
        <Main>
          <section className='body'>
            <CollectionContentList
              contents={contents}
              collection={collection_version.name}
              namespace={collection_version.namespace}
              params={params}
              updateParams={(p) => this.updateParams(p)}
            ></CollectionContentList>
          </section>
        </Main>
      </React.Fragment>
    );
  }

  private loadCollections(forceReload) {
    loadCollection({
      forceReload,
      matchParams: this.props.routeParams,
      navigate: this.props.navigate,
      selectedRepo: this.context.selectedRepo,
      setCollection: (collections, collection) => {
        this.setState({ collections, collection });
        const { namespace, name, version } = collection.collection_version;
        CollectionAPI.getContent2(namespace, name, version).then((res) => {
          const { contents } = res.data.results[0];
          this.setState({ contents });
        });
      },
      stateParams: this.state.params,
    });
  }

  get updateParams() {
    return ParamHelper.updateParamsMixin();
  }
}

export default withRouter(CollectionContent);

CollectionContent.contextType = AppContext;
