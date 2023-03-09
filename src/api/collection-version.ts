import {
  CollectionVersionSearch,
  PulpAnsibleDistributionType,
  RepositoryDistributionsAPI,
} from '../api';
import { HubAPI } from './hub';

interface ReturnCollection {
  data: {
    meta: {
      count: number;
    };
    links: {
      first: string;
      last: string;
      next?: string;
      previous?: string;
    };
    data: CollectionVersionSearch[];
  };
}

export class API extends HubAPI {
  apiPath = 'v3/plugin/ansible/search/collection-versions/';

  setRepository(
    namespace: string,
    name: string,
    version: string,
    originalRepo: string,
    destinationRepo: string,
  ) {
    const path = `v3/collections/${namespace}/${name}/versions/${version}/move/${originalRepo}/${destinationRepo}/`;
    return this.create({}, path);
  }

  queryCollectionsWithDistributions(params): Promise<ReturnCollection> {
    return new Promise((resolve, reject) => {
      super.list(params).then((result) => {
        const { data, meta } = result.data;

        const mappedRepoHrefToDistros = {};

        if (meta.count <= 0) {
          return resolve(result);
        }

        RepositoryDistributionsAPI.queryDistributionsByRepositoryHrefs({}, data)
          .then((res) => {
            res.data.results.forEach((distro: PulpAnsibleDistributionType) => {
              if (distro.repository in mappedRepoHrefToDistros) {
                mappedRepoHrefToDistros[distro.repository].push(distro);
              } else {
                mappedRepoHrefToDistros[distro.repository] = [distro];
              }
            });

            const collections = data.map(
              (collection: CollectionVersionSearch) => {
                const distros =
                  mappedRepoHrefToDistros[collection.repository.pulp_href];
                collection['distribution'] = null;

                if (distros.length <= 0) {
                  return collection;
                }

                const relatedDistro = distros.find(
                  (d) => d.name === collection.repository.name,
                );

                collection['distribution'] = relatedDistro
                  ? relatedDistro
                  : distros[0];

                return collection;
              },
            );

            result.data.data = collections;
            return resolve(result);
          })
          .catch((error) => reject(error));
      });
    });
  }
}

export const CollectionVersionAPI = new API();
