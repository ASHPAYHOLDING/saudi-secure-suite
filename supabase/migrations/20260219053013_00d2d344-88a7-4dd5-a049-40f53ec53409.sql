-- Fix: Reset work_mem for authenticator role which has invalid "16mb" value
ALTER ROLE authenticator RESET work_mem;