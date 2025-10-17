using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Serilog;
using System.Diagnostics;
using System.Text.Json;
using Retroscope.Auth.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Configure CORS
var allowedOrigins = builder.Configuration["ALLOW_ORIGINS"]?.Split(',') ?? ["http://localhost:5173", "http://localhost:3000", "http://localhost:8081"
];
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Configure Dual-Path Authentication (Supabase + Local Auth)
// Similar to dual-path data proxy, supports routing based on headers
var isDevelopment = builder.Environment.IsDevelopment();
builder.Services.AddRetroscopeAuth(builder.Configuration, isDevelopment);

// Register services
// Use real Supabase gateway by default; tests can override with a mock via WebApplicationFactory
Retroscope.Infrastructure.ServiceCollectionExtensions.AddSupabaseGateway(builder.Services, builder.Configuration);

// Register HttpClient for health checks
builder.Services.AddHttpClient<Retroscope.Api.Controllers.HealthController>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Disable HTTPS redirection in Development to avoid 307s during local testing
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Use CORS before authentication
app.UseCors();

// Add auth routing header middleware (for debugging and monitoring)
app.Use(async (context, next) =>
{
    // Check which auth system is being used
    var useLocalAuth = context.Request.Headers["X-UseLocalAuth"].FirstOrDefault() == "true";
    context.Response.Headers["X-Auth-System"] = useLocalAuth ? "Local" : "Supabase";
    
    await next();
});

// Add correlation ID middleware
app.Use(async (context, next) =>
{
    var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault() 
        ?? context.Request.Headers["Request-Id"].FirstOrDefault() 
        ?? Guid.NewGuid().ToString();
    
    // Add to response headers
    context.Response.Headers["X-Correlation-Id"] = correlationId;
    context.Response.Headers["Request-Id"] = correlationId;
    
    // Add to log context
    using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
    using (Serilog.Context.LogContext.PushProperty("RequestId", correlationId))
    {
        Log.Information("Request started: {Method} {Path}", context.Request.Method, context.Request.Path);
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            await next();
        }
        finally
        {
            stopwatch.Stop();
            Log.Information("Request completed: {Method} {Path} {StatusCode} in {ElapsedMs}ms", 
                context.Request.Method, context.Request.Path, context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
        }
    }
});

// Enable auth middleware (Dev handler in Development; JWT in non-Development)
app.UseAuthentication();
app.UseAuthorization();

// Health endpoints are handled by HealthController

app.MapControllers();

app.Run();
