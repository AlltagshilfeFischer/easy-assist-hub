-- Enable Realtime for termine table so all clients receive live updates
ALTER TABLE termine REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE termine;
