import type { Actions } from './$types';
import { handleSubmission } from '$lib/server/submitAction';

export const actions: Actions = {
  default: (event) => handleSubmission(event, 'donation')
};
