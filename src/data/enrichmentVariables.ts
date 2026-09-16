export interface EnrichmentVariable {
  id: string;
  label: string;
  unit?: "currency";
}

export interface EnrichmentCollection {
  collectionId: string;
  label: string;
  variables: EnrichmentVariable[];
}

// Trimmed to exactly the six demographic cards this app shows. Education,
// Employment, and Population Projections were dropped entirely -- none
// map to a card. Spending trimmed from all 20 categories to just CS01
// (Food & Non-Alcoholic Beverage), matching "Consumer spending on Food &
// Beverages" specifically rather than a generic spending card.
export const ENRICHMENT_COLLECTIONS: EnrichmentCollection[] = [
  {
    collectionId: "PopulationEsriIndia",
    label: "Population analysis",
    variables: [
      { id: "TOTPOP_CY", label: "2024 Total Population" },
      { id: "POPDENS_CY", label: "2024 Population Density (per km²)" },
      { id: "POPPRM_CY", label: "2024 Population Per Mill" },
      { id: "MALES_CY", label: "2024 Total Male Population" },
      { id: "FEMALES_CY", label: "2024 Total Female Population" },
      { id: "TOT_P_2011", label: "2011 Total Population" },
      { id: "TOT_M_2011", label: "2011 Male Population" },
      { id: "TOT_F_2011", label: "2011 Female Population" },
      { id: "P_06_2011", label: "2011 Total Population 0-6 Yrs" },
      { id: "M_06_2011", label: "2011 Male Population 0-6 Yrs" },
      { id: "F_06_2011", label: "2011 Female Population 0-6 Yrs" },
    ],
  },
  {
    collectionId: "15YearIncrementsEsriIndia",
    label: "Age-group segmentation",
    variables: [
      { id: "PAGE01_CY", label: "2024 Total Population Age 0-14" },
      { id: "PAGE02_CY", label: "2024 Total Population Age 15-29" },
      { id: "PAGE03_CY", label: "2024 Total Population Age 30-44" },
      { id: "PAGE04_CY", label: "2024 Total Population Age 45-59" },
      { id: "AGE_T15PL", label: "2024 Total Population Age 15+" },
      { id: "PAGE05_CY", label: "2024 Total Population Age 60+" },
      { id: "MAGE01_CY", label: "2024 Male Population Age 0-14" },
      { id: "MAGE02_CY", label: "2024 Male Population Age 15-29" },
      { id: "MAGE03_CY", label: "2024 Male Population Age 30-44" },
      { id: "MAGE04_CY", label: "2024 Male Population Age 45-59" },
      { id: "MAGE05_CY", label: "2024 Male Population Age 60+" },
      { id: "FAGE01_CY", label: "2024 Female Population Age 0-14" },
      { id: "FAGE02_CY", label: "2024 Female Population Age 15-29" },
      { id: "FAGE03_CY", label: "2024 Female Population Age 30-44" },
      { id: "FAGE04_CY", label: "2024 Female Population Age 45-59" },
      { id: "FAGE05_CY", label: "2024 Female Population Age 60+" },
    ],
  },
  {
    collectionId: "PurchasingPowerEsriIndia",
    label: "Income-based analysis",
    variables: [
      { id: "PP_CY", label: "2024 Purchasing Power: Total", unit: "currency" },
      { id: "PPPRM_CY", label: "2024 Purchasing Power: Per Mill" },
      { id: "PPPC_CY", label: "2024 Purchasing Power: Per Capita", unit: "currency" },
      { id: "PPIDX_CY", label: "2024 Purchasing Power: Index" },
    ],
  },
  {
    collectionId: "ConsumerStylesEsriIndia",
    label: "Lifestyle segmentation",
    variables: [
      { id: "TYPE_A", label: "Type A: High Earning Urban Professionals" },
      { id: "TYPE_B", label: "Type B: Comfortably Off Empty Nesters" },
      { id: "TYPE_C", label: "Type C: Modern and Pragmatic Over 50s" },
      { id: "TYPE_D", label: "Type D: Well Informed Modern Consumers" },
      { id: "TYPE_E", label: "Type E: Affluent Highly Educated Urban Families" },
      { id: "TYPE_F", label: "Type F: Security-Oriented Seniors" },
      { id: "TYPE_G", label: "Type G: Orientation Seeking Lower and Middle Class Consumers" },
      { id: "TYPE_H", label: "Type H: Younger Lower and Middle Class Consumers" },
      { id: "TYPE_I", label: "Type I: Modern Younger Families" },
      { id: "TYPE_J", label: "Type J: Low-Income Younger Consumers" },
    ],
  },
  {
    collectionId: "SpendingEsriIndia",
    label: "Consumer spending on Food & Beverages",
    variables: [{ id: "CS01_CY", label: "Food & Non-Alcoholic Beverage Spending", unit: "currency" }],
  },
  {
    collectionId: "HouseholdsEsriIndia",
    label: "Household analysis",
    variables: [
      { id: "TOTHH_CY", label: "2024 Total Households" },
      { id: "AVGHHSZ_CY", label: "2024 Average Household Size" },
      { id: "OW_OWNED_2011", label: "2011 HHs: Owned House" },
      { id: "OW_RENTED_2011", label: "2011 HHs: Rented House" },
      { id: "HH_4WHEEL_2011", label: "2011 HHs With a Car/Jeep/Van" },
      { id: "HH_2WHEEL_2011", label: "2011 HHs With a Scooter/Motorcycle" },
      { id: "HH_TVCOMP_2011", label: "2011 HHs With a TV/Computer/Laptop" },
      { id: "HH_CMP_INT_2011", label: "2011 HHs With a Computer & Internet" },
      { id: "HH_PH_MOB_2011", label: "2011 HHs With a Mobile Phone" },
    ],
  },
];