import { DEMO_MODE } from '../../config';
import { DemoGroupsView } from '../../demo/DemoGroupsView';
import { GroupsManager } from './GroupsManager';

export function AdminGroupsPage() {
  return DEMO_MODE ? <DemoGroupsView /> : <GroupsManager />;
}
