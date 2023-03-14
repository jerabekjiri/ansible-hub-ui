import {
  CollectionAPI,
  CollectionDetailType,
  CollectionVersionAPI,
  CollectionVersionSearch,
  PulpAnsibleDistributionType,
} from 'src/api';
import { AlertType } from 'src/components';
import { Paths, formatPath } from 'src/paths';

export interface IBaseCollectionState {
  params: {
    version?: string;
    showing?: string;
    keywords?: string;
  };
  collections?: CollectionVersionSearch[];
  collection?: CollectionVersionSearch;
  alerts?: AlertType[];
  distroBasePath?: string;
}

export function loadCollection({
  forceReload,
  matchParams,
  navigate,
  selectedRepo,
  setCollection,
  stateParams,
}) {
  // CollectionAPI.getCached(
  //   matchParams['namespace'],
  //   matchParams['collection'],
  //   selectedRepo,
  // { ...stateParams, include_related: 'my_permissions' },
  //   forceReload,
  // ).then((result) => {
  //console.log(result);
  // .then((result) => {

  return CollectionVersionAPI.list({
    name: matchParams['collection'],
    repository_name: selectedRepo,
    order_by: '-version',
  }).then((result) => {
    const res = result.data.data;
    setCollection(
      res,
      res.find((cv) => cv.is_highest),
    );
  });
  // .catch(() => {
  //   navigate(formatPath(Paths.notFound));
  // });
  // })
}
