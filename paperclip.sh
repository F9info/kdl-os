#!/bin/bash
# Start Paperclip using its own database (paperclip_db), separate from KDL app (kdl_db)
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/paperclip_db npx paperclipai@latest run
