using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Retroscope.Auth.Data;
using Retroscope.Auth.Services;
using System.Text;

namespace Retroscope.Auth.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRetroscopeAuth(this IServiceCollection services, IConfiguration configuration)
    {
        // Add DbContext
        services.AddDbContext<AuthDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // Add HttpClient for OAuth
        services.AddHttpClient<IAuthService, AuthService>();

        // Add Auth Service
        services.AddScoped<IAuthService, AuthService>();

        // Add JWT Authentication
        var jwtSecret = configuration["JWT:Secret"];
        var jwtIssuer = configuration["JWT:Issuer"];

        if (string.IsNullOrEmpty(jwtSecret))
        {
            throw new InvalidOperationException("JWT:Secret is required in configuration");
        }

        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwtIssuer,
                ValidAudience = "authenticated",
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                ClockSkew = TimeSpan.FromMinutes(2)
            };
        });

        services.AddAuthorization();

        return services;
    }
}
