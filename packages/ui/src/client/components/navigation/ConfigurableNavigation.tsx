import { ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { useNavigation, type NavigationItem } from '../../contexts';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '../ui/sidebar';

interface NavigationItemComponentProps {
  item: NavigationItem;
  isExpanded?: boolean;
  onToggle?: (itemId: string) => void;
}

function NavigationItemComponent({ item, isExpanded, onToggle }: NavigationItemComponentProps) {
  const hasChildren = item.children && item.children.length > 0;
  const hasActions = item.actions && item.actions.length > 0;

  // On mobile the sidebar is a sheet overlay: navigating should dismiss it,
  // otherwise it stays open over the destination page.
  const { isMobile, setOpenMobile } = useSidebar();
  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  if (hasChildren) {
    return (
      <Collapsible open={isExpanded} onOpenChange={() => onToggle?.(item.id)}>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton tooltip={item.title} isActive={item.isActive}>
              {item.icon}
              <span>{item.title}</span>
              {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
              {!hasActions && (
                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              )}
            </SidebarMenuButton>
          </CollapsibleTrigger>
          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction>
                  <MoreHorizontalIcon />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end">
                {item.actions?.map((action) => (
                  <DropdownMenuItem key={action.id} onClick={action.onClick} asChild={!!action.url}>
                    {action.url ? (
                      <Link href={action.url}>
                        {action.icon}
                        <span>{action.title}</span>
                      </Link>
                    ) : (
                      <>
                        {action.icon}
                        <span>{action.title}</span>
                      </>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.children?.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  <SidebarMenuSubButton asChild isActive={child.isActive}>
                    <Link href={child.url || '#'} onClick={closeMobileSidebar}>
                      {child.icon}
                      <span>{child.title}</span>
                      {child.badge && <SidebarMenuBadge>{child.badge}</SidebarMenuBadge>}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title} isActive={item.isActive}>
        <Link href={item.url || '#'} onClick={closeMobileSidebar}>
          {item.icon}
          <span>{item.title}</span>
          {item.badge && <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>}
        </Link>
      </SidebarMenuButton>
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction>
              <MoreHorizontalIcon />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end">
            {item.actions?.map((action) => (
              <DropdownMenuItem key={action.id} onClick={action.onClick} asChild={!!action.url}>
                {action.url ? (
                  <Link href={action.url}>
                    {action.icon}
                    <span>{action.title}</span>
                  </Link>
                ) : (
                  <>
                    {action.icon}
                    <span>{action.title}</span>
                  </>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </SidebarMenuItem>
  );
}

export function ConfigurableNavigation() {
  const { navigation } = useNavigation();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());

  const handleToggle = React.useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  return (
    <>
      {navigation.groups.map((group) => (
        <SidebarGroup key={group.id}>
          {group.title && <SidebarGroupLabel>{group.title}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <NavigationItemComponent
                  key={item.id}
                  item={item}
                  isExpanded={expandedItems.has(item.id)}
                  onToggle={handleToggle}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
