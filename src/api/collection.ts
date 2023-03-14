import axios from 'axios';
import {
  CollectionDetailType,
  CollectionListType,
  CollectionUploadType,
  CollectionVersionSearch,
  RepositoryDistributionsAPI,
} from 'src/api';
import { HubAPI } from './hub';

// return correct distro
export function findDistroBasePathByRepo(distributions, repository) {
  if (distributions.length === 0) {
    // if distribution doesn't exist, use repository name
    return repository.name;
  }

  // try to look for match by name, if not, just use the first distro
  const distro = distributions.find(
    (distro) => distro.name === repository.name,
  );
  return distro ? distro.base_path : distro[0].base_path;
}

function filterContents(contents) {
  if (contents) {
    return contents.filter(
      (item) => !['doc_fragments', 'module_utils'].includes(item.content_type),
    );
  }

  return contents;
}

function filterListItem(item: CollectionListType) {
  return {
    ...item,
    latest_version: {
      ...item.latest_version,
      contents: null, // deprecated
      metadata: {
        ...item.latest_version.metadata,
        contents: filterContents(item.latest_version.metadata.contents),
      },
    },
  };
}

function filterDetailItem(item: CollectionDetailType) {
  return {
    ...item,
    latest_version: {
      ...item.latest_version,
      contents: null, // deprecated
      docs_blob: {
        ...item.latest_version.docs_blob,
        contents: filterContents(item.latest_version.docs_blob.contents),
      },
      metadata: {
        ...item.latest_version.metadata,
        contents: filterContents(item.latest_version.metadata.contents),
      },
    },
  };
}

export class API extends HubAPI {
  apiPath = this.getUIPath('repo/');
  cachedCollection: CollectionDetailType;

  list(params?, repo?: string) {
    const path = this.apiPath + repo + '/';
    return super.list(params, path).then((response) => ({
      ...response,
      data: {
        ...response.data,
        // remove module_utils, doc_fragments from each item
        data: response.data.data.map(filterListItem),
      },
    }));
  }

  getPublishedCount(distributionPath: string) {
    return this.http
      .get(`v3/plugin/ansible/content/${distributionPath}/collections/index/`)
      .then((result) => {
        return result.data.meta.count;
      });
  }

  getExcludesCount(distributionPath: string) {
    return this.http
      .get(`content/${distributionPath}/v3/excludes/`)
      .then((result) => {
        return result.data;
      });
  }

  setDeprecation(collection: CollectionVersionSearch) {
    const {
      collection_version: { namespace, name },
      repository,
      is_deprecated,
    } = collection;
    return new Promise((resolve, reject) => {
      RepositoryDistributionsAPI.list({
        repository: repository.pulp_href,
      })
        .then((result) => {
          const basePath = findDistroBasePathByRepo(result.data, repository);

          const path = `v3/plugin/ansible/content/${basePath}/collections/index/`;
          this.patch(
            `${namespace}/${name}`,
            {
              deprecated: is_deprecated,
            },
            path,
          )
            .then((res) => resolve(res))
            .catch((err) => reject(err));
        })
        .catch((err) => reject(err));
    });
  }

  upload(
    data: CollectionUploadType,
    progressCallback: (e) => void,
    cancelToken?,
  ) {
    const formData = new FormData();
    formData.append('file', data.file);
    // formData.append('sha256', artifact.sha256);

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: progressCallback,
    };

    if (cancelToken) {
      config['cancelToken'] = cancelToken.token;
    }
    return this.http.post('v3/artifacts/collections/', formData, config);
  }

  getCancelToken() {
    return axios.CancelToken.source();
  }

  // Caches the last collection returned from the server. If the requested
  // collection matches the cache, return it, if it doesn't query the API
  // for the collection and replace the old cache with the new value.
  // This allows the collection page to be broken into separate components
  // and routed separately without fetching redundant data from the API
  getCached(
    namespace,
    name,
    repo,
    params?,
    forceReload?: boolean,
  ): Promise<CollectionDetailType> {
    if (
      !forceReload &&
      this.cachedCollection &&
      this.cachedCollection.name === name &&
      this.cachedCollection.namespace.name === namespace
    ) {
      return Promise.resolve(this.cachedCollection);
    }

    const path = `${this.apiPath}${repo}/${namespace}/${name}/`;
    return this.http
      .get(path, {
        params: params,
      })
      .then((result) => {
        // remove module_utils, doc_fragments from item
        const item = filterDetailItem(result.data);
        this.cachedCollection = item;
        return item;
      });
  }

  getDownloadURL(repository, namespace, name, version) {
    // UI API doesn't have tarball download link, so query it separately here
    return new Promise((resolve, reject) => {
      RepositoryDistributionsAPI.list({
        repository: repository.pulp_href,
      })
        .then((result) => {
          const basePath = findDistroBasePathByRepo(
            result.data.results,
            repository,
          );

          this.http
            .get(
              `v3/plugin/ansible/content/${basePath}/collections/index/${namespace}/${name}/versions/${version}/`,
            )
            .then((result) => {
              resolve(result.data['download_url']);
            })
            .catch((err) => reject(err));
        })
        .catch((err) => reject(err));
    });
  }

  deleteCollectionVersion(repo, collection) {
    return this.http.delete(
      `v3/plugin/ansible/content/${repo}/collections/index/${collection.namespace.name}/${collection.name}/versions/${collection.latest_version.version}/`,
    );
  }

  deleteCollection(repo, collection) {
    return this.http.delete(
      `v3/plugin/ansible/content/${repo}/collections/index/${collection.namespace.name}/${collection.name}/`,
    );
  }

  getUsedDependenciesByCollection(
    namespace,
    collection,
    params = {},
    cancelToken = undefined,
  ) {
    return this.http.get(
      this.getUIPath(
        `collection-versions/?dependency=${namespace}.${collection}`,
      ),
      { params: this.mapPageToOffset(params), cancelToken: cancelToken?.token },
    );
  }

  getContent(distroBasePath, namespace, name, version) {
    // missing signatures
    // return super.list({ namespace, name, version }, `pulp/api/v3/content/ansible/collection_versions/`)

    // missing docs_blob
    return this.http.get(
      `v3/plugin/ansible/content/${distroBasePath}/collections/index/${namespace}/${name}/versions/${version}/`,
    );
  }

  getContent2(namespace, name, version) {
    return super.list(
      {
        namespace,
        name,
        version,
      },
      `pulp/api/v3/content/ansible/collection_versions/`,
    );
  }

  getDocs(distroBasePath, namespace, name, version) {
    return this.http.get(
      `v3/plugin/ansible/content/${distroBasePath}/collections/index/${namespace}/${name}/versions/${version}/docs-blob/`,
    );
  }
}

export const CollectionAPI = new API();
