-- Runs once, when the dev database volume is first created.
-- The backend test suite uses this separate database so it never touches dev data.
CREATE DATABASE taskplus_test OWNER taskplus;
