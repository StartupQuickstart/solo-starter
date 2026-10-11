-- Runs once on first container start: integration tests use a separate
-- database so `pnpm test:int` can truncate freely without touching dev data.
CREATE DATABASE app_test;
