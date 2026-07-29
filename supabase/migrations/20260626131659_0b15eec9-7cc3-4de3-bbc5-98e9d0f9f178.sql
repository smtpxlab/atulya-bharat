DROP INDEX IF EXISTS public.user_milestones_reg_milestone_uniq;

CREATE UNIQUE INDEX user_milestones_reg_milestone_uniq
  ON public.user_milestones (registration_id, milestone_id);