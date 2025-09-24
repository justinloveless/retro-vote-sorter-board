using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.IdentityModel.Tokens.Jwt;
using Retroscope.Api.Controllers;
using Serilog;
using System.Diagnostics;
using System.Text.Json;
using System.Security.Cryptography.X509Certificates;

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

// Configure Authentication
var supabaseUrl = builder.Configuration["SUPABASE_URL"];
var supabaseIssuer = $"{supabaseUrl}/auth/v1";
var supabaseJwksUrl = builder.Configuration["SUPABASE_JWKS_URL"] ?? $"{supabaseIssuer}/.well-known/jwks.json";
var supabaseAnonKey = builder.Configuration["SUPABASE_ANON_KEY"];
var isDevelopment = builder.Environment.IsDevelopment();

if (isDevelopment)
{
    builder.Services.AddAuthentication("Dev")
        .AddScheme<AuthenticationSchemeOptions, Retroscope.Api.DevelopmentAuthHandler>("Dev", options => { });
}
else
{
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, options =>
    {
        if (!isDevelopment)
        {
            options.Authority = supabaseIssuer;
        }
        options.Audience = "authenticated";
        options.RequireHttpsMetadata = false; // Set to true in production
        options.SaveToken = true;
        options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
        {
            ValidateIssuer = !isDevelopment && false ? true : false,
            ValidateAudience = !isDevelopment && false ? true : false,
            ValidateLifetime = !isDevelopment && false ? true : false,
            ValidateIssuerSigningKey = false,
            RequireSignedTokens = false,
            ClockSkew = TimeSpan.FromMinutes(2),
            ValidIssuer = supabaseIssuer,
            ValidAudience = "authenticated",
            IssuerSigningKeyResolver = isDevelopment ? null : new IssuerSigningKeyResolver((token, securityToken, kid, parameters) =>
            {
                try
                {
                    using var httpClient = new HttpClient();
                    if (!string.IsNullOrEmpty(supabaseAnonKey))
                    {
                        httpClient.DefaultRequestHeaders.Add("apikey", supabaseAnonKey);
                        httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", supabaseAnonKey);
                    }
                    var jwksResponse = httpClient.GetStringAsync(supabaseJwksUrl).GetAwaiter().GetResult();
                    var jwks = JsonSerializer.Deserialize<JsonElement>(jwksResponse);
                    
                    if (jwks.TryGetProperty("keys", out var keys))
                    {
                        var securityKeys = new List<SecurityKey>();
                        foreach (var key in keys.EnumerateArray())
                        {
                            if (key.TryGetProperty("n", out var modulus) && key.TryGetProperty("e", out var exponent))
                            {
                                var nBytes = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.DecodeBytes(modulus.GetString()!);
                                var eBytes = Microsoft.IdentityModel.Tokens.Base64UrlEncoder.DecodeBytes(exponent.GetString()!);
                                var rsa = System.Security.Cryptography.RSA.Create();
                                rsa.ImportParameters(new System.Security.Cryptography.RSAParameters { Modulus = nBytes, Exponent = eBytes });
                                securityKeys.Add(new RsaSecurityKey(rsa));
                            }
                        }
                        return securityKeys;
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning("Failed to fetch JWKS from {JwksUrl}: {Error}", supabaseJwksUrl, ex.Message);
                }
                return new List<SecurityKey>();
            })
        };

        // In non-development, validate by introspecting with Supabase when JWKS is not usable.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                try
                {
                    var authHeader = context.Request.Headers["Authorization"].ToString();
                    if (string.IsNullOrEmpty(authHeader))
                    {
                        context.Fail("Missing Authorization header");
                        return Task.CompletedTask;
                    }

                    using var httpClient = new HttpClient();
                    if (!string.IsNullOrEmpty(supabaseAnonKey))
                    {
                        httpClient.DefaultRequestHeaders.Add("apikey", supabaseAnonKey);
                    }
                    httpClient.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", authHeader);

                    var userEndpoint = $"{supabaseIssuer}/user";
                    var response = httpClient.GetAsync(userEndpoint).GetAwaiter().GetResult();
                    if (!response.IsSuccessStatusCode)
                    {
                        Log.Warning("Supabase introspection failed with {StatusCode}", response.StatusCode);
                        context.Fail($"Supabase token introspection failed: {(int)response.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Supabase token introspection error");
                    context.Fail("Token introspection error");
                }

                return Task.CompletedTask;
            }
        };
    });
}

// Configure authorization
builder.Services.AddAuthorization(options =>
{
    // Note: No fallback policy - endpoints will use explicit [Authorize] or [AllowAnonymous] attributes
    // This allows health endpoints to work without authentication while protecting other endpoints
});

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
