import { NotificationType } from '../../../generated/prisma/enums';

/**
 * EmailNotification Entity - Email notification response format
 */
export interface EmailNotificationEntity {
  Id: number;
  Name: string;
  Email: string;
  Type: NotificationType;
}
