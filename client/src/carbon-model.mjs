// Published US operating averages (CO2) and an ICCT manufacturing benchmark (CO2e).
// EIA's 2023 utility-scale average: 0.81 lb CO2/kWh, rounded to grams.
export const CARBON_BASELINE = Object.freeze({
  gasProduction: 8,
  gridIntensity: 367,
  gasIntensity: 400,
});
export const ANNUAL_MILES = 13662;
// EPA gasoline tailpipe CO2 factor, in grams per US gallon.
export const GASOLINE_CO2_PER_GALLON = 8887;
export const gasEmissionsPerMile = (mpg) => GASOLINE_CO2_PER_GALLON / mpg;

// Simplified footprint estimate: tonnes for production, grams per mile for operation.
export function carbonModel({ evProduction, gasProduction, gridIntensity, efficiency, gasIntensity, annualMiles }) {
  const evPerMile = gridIntensity * efficiency / 100;
  const advantage = gasIntensity - evPerMile;
  const debt = (evProduction - gasProduction) * 1e6;
  const breakEvenMiles = debt <= 0 ? 0 : advantage > 0 ? debt / advantage : null;
  return { evPerMile, breakEvenMiles, years: breakEvenMiles === null ? null : breakEvenMiles / annualMiles,
    evAt: (miles) => evProduction + miles * evPerMile / 1e6,
    gasAt: (miles) => gasProduction + miles * gasIntensity / 1e6 };
}
