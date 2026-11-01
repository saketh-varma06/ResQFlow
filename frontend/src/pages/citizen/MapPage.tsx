import { PageHeader } from "@/components/PageHeader";
import OperationsMap from "@/components/OperationsMap";
export default function MapPage() {
  return (
    <div>
      <PageHeader title="Area map" description="Live incidents, SOS requests and shelters from the backend on OpenStreetMap." />
      <OperationsMap sosScopeNote="SOS pins show your own requests only." />
    </div>
  );
}
