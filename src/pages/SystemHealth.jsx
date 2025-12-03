import PermissionGuard from "../components/security/PermissionGuard";
import SystemHealthDashboard from "../components/global/SystemHealthDashboard";

export default function SystemHealth() {
  return (
    <PermissionGuard permission="VIEW_SYSTEM_HEALTH">
      <div className="p-6">
        <SystemHealthDashboard />
      </div>
    </PermissionGuard>
  );
}