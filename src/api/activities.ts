import { HubAPI } from './hub';

class API extends HubAPI {
  apiPath = 'v3/plugin/execution-environments/repositories/';

  list(id, page) {
    return super.list({ page: page }, this.apiPath + id + '/_content/history/');
  }
}

export const ActivitiesAPI = new API();
