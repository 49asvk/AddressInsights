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

// Sourced directly from the account's DataCollections listing for India
// (both "EsriIndia" and "census" hierarchies checked) -- no invented IDs
// or labels. Several duplicate/niche collections were deliberately
// left out; see chat for the full list.
export const ENRICHMENT_COLLECTIONS: EnrichmentCollection[] = [
  {
    collectionId: "PopulationEsriIndia",
    label: "Population",
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
    label: "Age (15-Year Increments)",
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
    label: "Purchasing Power",
    variables: [
      { id: "PP_CY", label: "2024 Purchasing Power: Total", unit: "currency" },
      { id: "PPPRM_CY", label: "2024 Purchasing Power: Per Mill" },
      { id: "PPPC_CY", label: "2024 Purchasing Power: Per Capita", unit: "currency" },
      { id: "PPIDX_CY", label: "2024 Purchasing Power: Index" },
    ],
  },
  {
    collectionId: "ConsumerStylesEsriIndia",
    label: "Consumer Styles",
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
    label: "Consumer Spending",
    variables: [
      { id: "CS01_CY", label: "Food & Non-Alcoholic Beverage Spending", unit: "currency" },
      { id: "CS02_CY", label: "Alcoholic Beverage Spending", unit: "currency" },
      { id: "CS03_CY", label: "Tobacco Spending", unit: "currency" },
      { id: "CS04_CY", label: "Clothing Spending", unit: "currency" },
      { id: "CS05_CY", label: "Footwear Spending", unit: "currency" },
      { id: "CS06_CY", label: "Furniture & Furnishing Spending", unit: "currency" },
      { id: "CS07_CY", label: "Household Textiles Spending", unit: "currency" },
      { id: "CS08_CY", label: "Household Appliances Spending", unit: "currency" },
      { id: "CS09_CY", label: "Household Utensils Spending", unit: "currency" },
      { id: "CS10_CY", label: "House & Garden Tools Spending", unit: "currency" },
      { id: "CS11_CY", label: "Household Maintenance Spending", unit: "currency" },
      { id: "CS12_CY", label: "Medical Products Spending", unit: "currency" },
      { id: "CS13_CY", label: "Electronics & IT Spending", unit: "currency" },
      { id: "CS14_CY", label: "Recreation Durables Spending", unit: "currency" },
      { id: "CS15_CY", label: "Toys, Sports & Pets Spending", unit: "currency" },
      { id: "CS16_CY", label: "Recreational Services Spending", unit: "currency" },
      { id: "CS17_CY", label: "Books & Stationery Spending", unit: "currency" },
      { id: "CS18_CY", label: "Catering Services Spending", unit: "currency" },
      { id: "CS19_CY", label: "Personal Care Spending", unit: "currency" },
      { id: "CS20_CY", label: "Personal Effects (Jewelry etc.) Spending", unit: "currency" },
    ],
  },
  {
    collectionId: "EducationEsriIndia",
    label: "Education (2011 Census)",
    variables: [
      { id: "P_LIT_2011", label: "2011 Total Population: Literate" },
      { id: "M_LIT_2011", label: "2011 Male Population: Literate" },
      { id: "F_LIT_2011", label: "2011 Female Population: Literate" },
      { id: "P_ILL_2011", label: "2011 Total Population: Illiterate" },
      { id: "M_ILL_2011", label: "2011 Male Population: Illiterate" },
      { id: "F_ILL_2011", label: "2011 Female Population: Illiterate" },
    ],
  },
  {
    collectionId: "HouseholdsEsriIndia",
    label: "Households & Assets",
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
  {
    collectionId: "JobsEsriIndia",
    label: "Employment (2011 Census)",
    variables: [
      { id: "TOT_WORK_P_2011", label: "2011 Total Population: Workers" },
      { id: "TOT_WORK_M_2011", label: "2011 Male Population: Workers" },
      { id: "TOT_WORK_F_2011", label: "2011 Female Population: Workers" },
      { id: "NON_WORK_P_2011", label: "2011 Total Population: Non-Workers" },
    ],
  },
  {
    collectionId: "ProjectedPopulationEsriIndia",
    label: "Population Projections",
    variables: [
      { id: "TOT_P_2030", label: "2030 Projected Total Population" },
      { id: "TOT_P_2036", label: "2036 Projected Total Population" },
    ],
  },
];