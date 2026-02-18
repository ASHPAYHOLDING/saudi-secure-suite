CREATE POLICY "Users can insert own affiliate record"
ON public.affiliates
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);