FROM postgres:15

# Copy initialization scripts
COPY init/*.sql /docker-entrypoint-initdb.d/

# Ensure scripts are executable
RUN chmod +r /docker-entrypoint-initdb.d/*.sql

