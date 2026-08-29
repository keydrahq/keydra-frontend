import type { FC, ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  Content,
  Flex,
  FlexItem,
  PageBreadcrumb,
  PageSection,
  Title,
} from '@patternfly/react-core';
import { Link } from 'react-router';

/** One step of the trail above the title. Without `to` it is the page itself. */
export interface Crumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  /** One line under the title. Long enough to explain the page, short enough not to be read twice. */
  description?: string;
  /** Where this page sits. Omitted on the top-level pages, which are their own trail. */
  breadcrumb?: Crumb[];
  /** Status labels shown beside the title, on the same line. */
  badges?: ReactNode;
  /** Controls aligned to the end of the header row. */
  actions?: ReactNode;
}

/**
 * The header section every page opens with: trail, title, one line of description, and the page's
 * controls.
 *
 * <p>This is PatternFly's page anatomy rather than an invention — breadcrumb section first, then a
 * header section carrying the title and an optional description, then the page's body. There is no
 * PatternFly `PageHeader` component in v6; the guidelines say to compose one from `PageSection` and
 * `Title`, which is what this is.
 *
 * <p>Shared rather than repeated so the pages line up with each other. Each feature had built its
 * own header out of Flex and Title and they had drifted: different heading sizes, descriptions on
 * some pages and not others, buttons at different heights.
 */
export const PageHeader: FC<PageHeaderProps> = ({
  title,
  description,
  breadcrumb,
  badges,
  actions,
}) => (
  <>
    {breadcrumb?.length ? (
      <PageBreadcrumb>
        <Breadcrumb>
          {breadcrumb.map((crumb) => (
            <BreadcrumbItem key={crumb.label} isActive={!crumb.to}>
              {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumb>
      </PageBreadcrumb>
    ) : null}

    {/* The shadow is what separates the header from the body below it, and it is the
        separation PatternFly's own page guidelines call for. */}
    <PageSection hasShadowBottom>
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        spaceItems={{ default: 'spaceItemsMd' }}
        flexWrap={{ default: 'nowrap' }}
      >
        <FlexItem grow={{ default: 'grow' }} className="keydra-page-header__text">
          <Flex
            alignItems={{ default: 'alignItemsCenter' }}
            spaceItems={{ default: 'spaceItemsSm' }}
            flexWrap={{ default: 'wrap' }}
          >
            <Title headingLevel="h1" size="xl">
              {title}
            </Title>
            {badges}
          </Flex>
          {description ? (
            <Content component="small" className="pf-v6-u-text-color-subtle">
              {description}
            </Content>
          ) : null}
        </FlexItem>
        {actions ? (
          <FlexItem>
            <Flex spaceItems={{ default: 'spaceItemsSm' }} flexWrap={{ default: 'nowrap' }}>
              {actions}
            </Flex>
          </FlexItem>
        ) : null}
      </Flex>
    </PageSection>
  </>
);
