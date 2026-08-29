import type { FC } from 'react';
import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardBody,
  CardTitle,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  PageSection,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { ErrorView } from '@app/Shared/Components/ErrorView';
import { LoadingView } from '@app/Shared/Components/LoadingView';
import type { AboutResponse } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { useDocumentTitle } from '@app/utils/hooks/useDocumentTitle';
import { PageHeader } from '@app/Shared/Components/PageHeader';

/** Reads GET /api/v1/about and renders the server's identity and build metadata. */
export const About: FC = () => {
  const { t } = useTranslation();
  const services = useContext(ServiceContext);
  useDocumentTitle(t('About.TITLE'));

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['about'],
    queryFn: () => services.api.doGet<AboutResponse>('/about'),
  });

  return (
    <>
      <PageHeader title={t('About.TITLE')} description={t('About.DESCRIPTION')} />
      {/* Width-limited: the card holds six short values, and stretched across a wide
          window each label sits an inch from the number it names. */}
      {/* The body wrapper is kept here, unlike on the pages that lock their height to the
          window: the width limit is applied to that wrapper and to nothing else, so asking
          for one without it puts the class on the section and changes nothing. */}
      <PageSection isFilled isWidthLimited>
        <Stack hasGutter>
          <StackItem>
            <Card isCompact>
              <CardTitle>{t('About.SERVER')}</CardTitle>
              <CardBody>
                {isPending ? <LoadingView /> : null}
                {isError ? (
                  <ErrorView
                    title={t('About.LOAD_ERROR_TITLE')}
                    message={t('About.LOAD_ERROR_BODY')}
                    onRetry={() => void refetch()}
                  />
                ) : null}
                {data ? (
                  <DescriptionList isHorizontal isCompact>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.NAME')}</DescriptionListTerm>
                      <DescriptionListDescription>{data.name}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.VERSION')}</DescriptionListTerm>
                      <DescriptionListDescription>{data.version}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.BUILD_TIMESTAMP')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.build.timestamp}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.COMMIT')}</DescriptionListTerm>
                      <DescriptionListDescription>{data.build.commit}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.JAVA_VERSION')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.build.javaVersion}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.QUARKUS_VERSION')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.build.quarkusVersion}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                ) : null}
              </CardBody>
            </Card>
          </StackItem>
          {/* Only where the server said which instance answered. It says so to somebody who
              has signed in and to nobody else, and one Keydra is the ordinary case: the card
              earns its place when a schedule did not run and the question is which process
              was supposed to run it. */}
          {data?.instance ? (
            <StackItem>
              <Card isCompact>
                <CardTitle>{t('About.INSTANCE')}</CardTitle>
                <CardBody>
                  <DescriptionList isHorizontal isCompact>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.INSTANCE_NAME')}</DescriptionListTerm>
                      <DescriptionListDescription>{data.instance.id}</DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.SHARED_WORK')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.instance.leader
                          ? t('About.SHARED_WORK_HERE')
                          : data.instance.chores
                            ? t('About.SHARED_WORK_ELSEWHERE', { instance: data.instance.chores })
                            : t('About.SHARED_WORK_NOWHERE')}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                </CardBody>
              </Card>
            </StackItem>
          ) : null}
          {data?.observability ? (
            <StackItem>
              <Card isCompact>
                <CardTitle>{t('About.EXPORTS')}</CardTitle>
                <CardBody>
                  <DescriptionList isHorizontal isCompact>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.METRICS')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.observability.metricsPath}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.TRACES')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.observability.traces
                          ? data.observability.tracesTo
                            ? t('About.TRACES_TO', { host: data.observability.tracesTo })
                            : t('About.TRACES_ON')
                          : t('About.TRACES_OFF')}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                    <DescriptionListGroup>
                      <DescriptionListTerm>{t('About.LOGS')}</DescriptionListTerm>
                      <DescriptionListDescription>
                        {data.observability.structuredLogs
                          ? t('About.LOGS_JSON')
                          : t('About.LOGS_PLAIN')}
                      </DescriptionListDescription>
                    </DescriptionListGroup>
                  </DescriptionList>
                </CardBody>
              </Card>
            </StackItem>
          ) : null}
        </Stack>
      </PageSection>
    </>
  );
};
