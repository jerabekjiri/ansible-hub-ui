import { CollectionVersionSearch, PulpAnsibleDistributionType } from '../api';
import { PulpAPI } from './pulp';

class API extends PulpAPI {
  apiPath = '/distributions/ansible/ansible/';

  // match repository with distribution
  // map distribution to repository pulp_href
  // {
  //    [repository.pulp_href]: {
  //        ...corresponding distribution
  //    }
  // }
  queryDistributionsByRepositoryHrefs(
    params,
    collections: CollectionVersionSearch[],
  ) {
    return new Promise((resolve, reject) => {
      const repoHrefs = Array.from(
        new Set(collections.map((c) => c.repository.pulp_href)),
      );

      if (!params['page_size']) {
        params['page_size'] = 999;
      }

      if (repoHrefs.length > 0) {
        params['repository__in'] = repoHrefs.join(',');
      }

      const mappedRepoHrefToDistro = {};

      return super
        .list(params)
        .then((res) => {
          res.data.results.forEach((distro: PulpAnsibleDistributionType) => {
            mappedRepoHrefToDistro[distro.repository] = distro;
          });
          return resolve(mappedRepoHrefToDistro);
        })
        .catch((error) => {
          return reject(error);
        });
    });
  }
}

export const RepositoryDistributionsAPI = new API();
