# Multi-stage Dockerfile for Retroscope API
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy all source files
COPY . ./

# Restore dependencies for the API project only
RUN dotnet restore src/Retroscope.Api/Retroscope.Api.csproj

# Build and publish the application
RUN dotnet build src/Retroscope.Api/Retroscope.Api.csproj --configuration Release --no-restore
RUN dotnet publish src/Retroscope.Api/Retroscope.Api.csproj \
    --configuration Release \
    --no-build \
    --output /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy published application from build stage
COPY --from=build /app/publish .

# Set ownership of the app directory to the appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the port the app runs on
EXPOSE 8080

# Set environment variables for production
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ASPNETCORE_URLS=http://+:8080

# Environment variables that can be overridden at runtime
ENV SUPABASE_URL=https://nwfwbjmzbwuyxehindpv.supabase.co
ENV SUPABASE_JWKS_URL=https://nwfwbjmzbwuyxehindpv.supabase.co/auth/v1/.well-known/jwks.json
ENV SUPABASE_POSTGREST_URL=https://nwfwbjmzbwuyxehindpv.supabase.co/rest/v1
ENV SUPABASE_FUNCTIONS_URL=https://nwfwbjmzbwuyxehindpv.supabase.co/functions/v1
ENV SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53Zndiam16Ynd1eXhlaGluZHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg1MjkyMzksImV4cCI6MjA2NDEwNTIzOX0.s_vI6z46NAYlpB8K0wznCWEr_cFcnsHh7Qn4LmsUZU0
ENV ALLOW_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/healthz || exit 1

# Start the application
ENTRYPOINT ["dotnet", "Retroscope.Api.dll"]
