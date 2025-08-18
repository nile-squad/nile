export const hasExpired = (
  duration: number,
  duration_units: string,
  created_at: string
): boolean => {
  const getDurationInHours = (
    durationToConvert: number,
    units: string
  ): number => {
    const unitMultipliers = {
      hour: 1,
      day: 24,
      week: 7 * 24,
      month: 30 * 24,
    };

    return (
      durationToConvert *
      (unitMultipliers[units.toLowerCase() as keyof typeof unitMultipliers] ||
        1)
    );
  };

  // Calculate expiration time
  const durationInHours = getDurationInHours(duration, duration_units);
  const createdAtDate = new Date(created_at);
  const expirationDate = new Date(
    createdAtDate.getTime() + durationInHours * 60 * 60 * 1000
  );

  // Always use current time
  const currentTime = new Date();

  return currentTime > expirationDate;
};
