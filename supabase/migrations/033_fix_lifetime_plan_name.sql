-- Migration 033: Fix lifetime plan name copied incorrectly from 'max' in migration 030
UPDATE plans SET name = 'Lifetime' WHERE id = 'lifetime' AND name = 'Max';
