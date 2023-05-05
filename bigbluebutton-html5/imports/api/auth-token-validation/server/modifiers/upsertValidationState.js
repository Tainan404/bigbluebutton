import Logger from '/imports/startup/server/logger';
import AuthTokenValidation from '/imports/api/auth-token-validation';

export default async function upsertValidationState(
  meetingId,
  userId,
  validationStatus,
  reason = null,
) {
  const selector = {
    meetingId, userId,
  };
  const modifier = {
    $set: {
      meetingId,
      userId,
      validationStatus,
      updatedAt: new Date().getTime(),
      reason,
    },
  };

  try {
    await AuthTokenValidation
      .removeAsync({ meetingId, userId });
    const { numberAffected } = AuthTokenValidation.upsertAsync(selector, modifier);

    if (numberAffected) {
      Logger.info(`Upserted ${JSON.stringify(selector)} ${validationStatus} in AuthTokenValidation`);
    }
  } catch (err) {
    Logger.error(`Could not upsert to collection AuthTokenValidation: ${err}`);
  }
}
