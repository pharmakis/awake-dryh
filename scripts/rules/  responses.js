export function validateResponseAllocation({
  fightTotal,
  fightChecked,
  flightTotal,
  flightChecked
}) {
  if (fightChecked > fightTotal) {
    return "AWAKE.Validation.FightCheckedExceedsTotal";
  }

  if (flightChecked > flightTotal) {
    return "AWAKE.Validation.FlightCheckedExceedsTotal";
  }

  const total = fightTotal + flightTotal;

  if (total !== 0 && total !== 3) {
    return "AWAKE.Validation.ResponseAllocation";
  }

  return null;
}