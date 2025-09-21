using Microsoft.IdentityModel.Tokens;
using Retroscope.Api.Controllers;
using Serilog;
using System.Diagnostics;

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
var allowedOrigins = builder.Configuration["ALLOW_ORIGINS"]?.Split(',') ?? new[] { "http://localhost:5173", "http://localhost:3000" };
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

// Configure JWT Authentication
var supabaseUrl = builder.Configuration["SUPABASE_URL"];
var supabaseJwksUrl = builder.Configuration["SUPABASE_JWKS_URL"] ?? $"{supabaseUrl}/auth/v1/keys";

builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.Authority = supabaseUrl;
        options.Audience = "authenticated";
        options.RequireHttpsMetadata = false; // Set to true in production
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
            {
                // For now, we'll implement a simple resolver
                // In a real implementation, you'd fetch the JWKS from supabaseJwksUrl
                return new List<Microsoft.IdentityModel.Tokens.SecurityKey>();
            }
        };
    });

// Configure authorization
builder.Services.AddAuthorization();

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

app.UseHttpsRedirection();

// Use CORS before authentication
app.UseCors();

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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
