/**
 * Responder field checklists (Stage E). One list per incident type / SOS category,
 * with a shared default. Items are practical first-response checks drawn from
 * standard field practice — they guide, they do not replace training or protocol.
 */
const DEFAULT_ITEMS = [
  "Confirm the exact location and safe access route",
  "Count people affected and identify anyone needing urgent medical help",
  "Check for immediate hazards (fire, live wires, unstable structures, rising water)",
  "Record what resources are needed on site",
  "Update the control room with a first situation report",
];

const BY_CATEGORY: Record<string, string[]> = {
  FLOOD: [
    "Check water depth, current speed and whether the level is still rising",
    "Check for live electrical hazards in or near the water",
    "Count people needing evacuation and identify who cannot self-evacuate",
    "Identify a safe high-ground route and a boat/vehicle staging point",
    "Look for signs of water contamination (sewage, fuel, chemicals)",
    "Record which buildings are inundated and to what depth",
  ],
  FIRE: [
    "Confirm the fire location, spread direction and wind conditions",
    "Check whether anyone is trapped inside or missing",
    "Verify gas and electrical supplies are isolated if safe to do so",
    "Establish a safe perimeter and an evacuation assembly point",
    "Identify water sources and access points for fire tenders",
    "Record hazardous materials stored on site",
  ],
  MEDICAL: [
    "Count patients and triage by urgency (breathing, bleeding, consciousness)",
    "Check for anyone dependent on powered medical equipment",
    "Confirm the nearest hospital route is passable",
    "Record allergies or critical medication needs reported on scene",
    "Arrange a clear landing/access point for the ambulance",
  ],
  TRAPPED: [
    "Establish voice or phone contact with the trapped people if possible",
    "Assess structural stability before any entry",
    "Check for gas leaks, live wires and secondary collapse risks",
    "Record the exact location/void where people are believed to be",
    "Identify what lifting, cutting or shoring equipment is needed",
    "Keep bystanders clear of the work zone",
  ],
  LANDSLIDE: [
    "Check slope stability and watch for secondary slides",
    "Establish a safe zone outside the runout path",
    "Count buried or missing people as reported by witnesses",
    "Record blocked roads and alternative access routes",
    "Check for damaged gas, water and power lines in the slide area",
  ],
  STORM: [
    "Check for fallen trees, poles and live wires blocking access",
    "Assess roof and structure damage for occupied buildings",
    "Count people needing shelter relocation",
    "Record flooding or waterlogging caused by the storm",
    "Identify safe routes for relief vehicles",
  ],
  INFRASTRUCTURE: [
    "Photograph and describe the structural damage",
    "Cordon the area and control bystander access",
    "Check whether utilities (gas, water, power) are damaged or leaking",
    "Count people displaced by the damage",
    "Record whether the structure is safe to enter",
  ],
};

export function checklistFor(category: string): { key: string; label: string }[] {
  const items = BY_CATEGORY[category] ?? DEFAULT_ITEMS;
  return items.map((label, i) => ({ key: `${category.toLowerCase()}-${i}`, label }));
}
