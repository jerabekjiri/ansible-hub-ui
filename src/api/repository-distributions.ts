import { CollectionVersionSearch } from '../api';
import { PulpAPI } from './pulp';

class API extends PulpAPI {
  apiPath = '/distributions/ansible/ansible/';

  queryDistributionsByRepositoryHrefs(
    params,
    collections: CollectionVersionSearch[],
  ) {
    const repoHrefs = Array.from(
      new Set(collections.map((c) => c.repository.pulp_href)),
    );

    if (!params['page_size']) {
      params['page_size'] = 99999;
    }

    if (repoHrefs.length > 0) {
      params['repository__in'] = repoHrefs.join(',');
    }

    return super.list(params);
  }
}

export const RepositoryDistributionsAPI = new API();
