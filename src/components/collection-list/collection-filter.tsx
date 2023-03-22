import { t } from '@lingui/macro';
import {
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Repositories } from 'src/api';
import { AppliedFilters, CompoundFilter } from 'src/components';
import { Constants } from 'src/constants';
import { useContext } from 'src/loaders/app-context';
import './collection-filter.scss';

interface IProps {
  ignoredParams: string[];
  params: {
    keywords?: string;
    page?: number;
    page_size?: number;
    tags?: string[];
    view_type?: string;
    repository__name?: string;
  };
  updateParams: (p) => void;
}

export const CollectionFilter = (props: IProps) => {
  const context = useContext();
  const [repositories, setRepositories] = useState([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    setInputText(props.params['keywords'] || '');
  }, [props.params.keywords]);

  useEffect(() => {
    setInputText(props.params['repository__name'] || '');
  }, [props.params.repository__name]);

  useEffect(() => {
    if (inputText != '') {
      Repositories.list({
        name__icontains: inputText,
      }).then((res) => {
        const repos = res.data.results.map(({ name }) => ({
          id: name,
          title: name,
        }));
        setRepositories(repos);
      });
    }
  }, [inputText]);

  const { ignoredParams, params, updateParams } = props;
  const { display_signatures } = context.featureFlags;
  const displayTags = ignoredParams.includes('tags') === false;
  const displayRepos = ignoredParams.includes('repository__name') === false;
  const displayNamespaces = ignoredParams.includes('namespace') === false;

  const filterConfig = [
    {
      id: 'keywords',
      title: t`Keywords`,
    },
    displayRepos && {
      id: 'repository__name',
      title: t`Repository`,
      inputType: 'typeahead' as const,
      options: repositories,
    },
    displayNamespaces && {
      id: 'namespace',
      title: t`Namespace`,
    },
    displayTags && {
      id: 'tags',
      title: t`Tag`,
      inputType: 'multiple' as const,
      options: Constants.COLLECTION_FILTER_TAGS.map((tag) => ({
        id: tag,
        title: tag,
      })),
    },
    display_signatures && {
      id: 'is_signed',
      title: t`Sign state`,
      inputType: 'select' as const,
      options: [
        { id: 'true', title: t`Signed` },
        { id: 'false', title: t`Unsigned` },
      ],
    },
  ].filter(Boolean);

  return (
    <Toolbar>
      <ToolbarContent>
        <ToolbarGroup style={{ marginLeft: 0 }}>
          <ToolbarItem>
            <CompoundFilter
              inputText={inputText}
              onChange={(text) => setInputText(text)}
              updateParams={updateParams}
              params={params}
              filterConfig={filterConfig}
            />
            <ToolbarItem>
              <AppliedFilters
                niceNames={{
                  is_signed: t`sign state`,
                  tags: t`tags`,
                  keywords: t`keywords`,
                  repository__name: t`repository`,
                  namespace: t`namespace`,
                }}
                niceValues={{
                  is_signed: {
                    false: t`unsigned`,
                    true: t`signed`,
                  },
                }}
                style={{ marginTop: '16px' }}
                updateParams={updateParams}
                params={params}
                ignoredParams={ignoredParams}
              />
            </ToolbarItem>
          </ToolbarItem>
        </ToolbarGroup>
      </ToolbarContent>
    </Toolbar>
  );
};
