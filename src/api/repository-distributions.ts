import { PulpAPI } from './pulp';
import { CollectionVersionSearch } from './response-types/collection';
import { PulpAnsibleDistributionType } from './response-types/distribution';

class API extends PulpAPI {
  apiPath = '/distributions/ansible/ansible/';

  queryDistributionsByRepositoryHrefs(
    repoHrefs: string[],
  ): Promise<PulpAnsibleDistributionType[]> {
    return new Promise((resolve, reject) => {
      const params = {
        page_size: '999',
      };

      if (repoHrefs.length > 0) {
        params['repository__in'] = repoHrefs.join(',');
      }

      super
        .list(params)
        .then((res) => {
          return resolve(res.data.results);
        })
        .catch((err) => {
          return reject(err);
        });
    });
  }

  queryDistributions(collections: CollectionVersionSearch[]) {
    return new Promise((resolve, reject) => {
      const repoHrefs = Array.from(
        new Set(collections.map((c) => c.repository.pulp_href)),
      );
      const repoHrefToDistro = {};

      this.queryDistributionsByRepositoryHrefs(repoHrefs)
        .then((res) => {
          res.forEach((distro) => {
            repoHrefToDistro[distro.repository] = distro;
          });
          return resolve(repoHrefToDistro);
        })
        .catch((error) => {
          return reject(error);
        });
    });
  }
}

export const RepositoryDistributionsAPI = new API();
