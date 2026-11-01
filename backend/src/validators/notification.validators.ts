import { z } from "zod";
import { paginationQuery } from "./common";
export const listNotificationsQuery = paginationQuery.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
