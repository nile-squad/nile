export const hasExpired = (
  duration: number,
  duration_units: string,
  created_at: string
): boolean => {
  const getDurationInHours = (
    durationToConvert: number,
    units: string
  ): number => {
    switch (units.toLowerCase()) {
      case 'hour':
        return durationToConvert;
      case 'day':
        return durationToConvert * 24;
      case 'week':
        return durationToConvert * 7 * 24;
      case 'month':
        return durationToConvert * 30 * 24;
      default:
        return durationToConvert;
    }
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
