using Microsoft.IdentityModel.Tokens;
using Retroscope.Api.Controllers;
using Retroscope.Api.Authentication;

var builder = WebApplication.CreateBuilder(args);

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

// For testing, we'll use a simple authentication scheme that accepts any bearer token
if (builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddAuthentication("Bearer")
        .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TestAuthenticationHandler>(
            "Bearer", options => { });
}
else
{
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
}

// Configure authorization
builder.Services.AddAuthorization();

// Register services
if (builder.Environment.IsEnvironment("Testing"))
{
    // Use mock for testing
    builder.Services.AddScoped<Retroscope.Application.Interfaces.ISupabaseGateway, MockSupabaseGateway>();
}
else
{
    // Use real Supabase gateway for production
    Retroscope.Infrastructure.ServiceCollectionExtensions.AddSupabaseGateway(builder.Services, builder.Configuration);
}

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Use CORS before authentication
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
