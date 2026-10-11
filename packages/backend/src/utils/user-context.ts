/** Who a database operation runs for. Passed to the model's `...WithContext` methods. */
export interface UserContext {
  userId?: string;
  showDeleted?: boolean;
  userClerkId?: string;
}
