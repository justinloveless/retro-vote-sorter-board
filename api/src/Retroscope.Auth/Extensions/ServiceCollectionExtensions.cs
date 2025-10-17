using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Retroscope.Auth.Data;
using Retroscope.Auth.Services;
using System.Text;
using System.Text.Json;

namespace Retroscope.Auth.Extensions;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddRetroscopeAuth(this IServiceCollection services, IConfiguration configuration, bool isDevelopment)
    {
        // Add DbContext for local auth
        services.AddDbContext<AuthDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection"),
                b => b.MigrationsHistoryTable("__EFMigrationsHistory", "auth"))); // Specify auth schema for migrations

        // Add HttpClient for OAuth
        services.AddHttpClient<IAuthService, AuthService>();

        // Add Auth Service
        services.AddScoped<IAuthService, AuthService>();

        // Configure dual-path JWT authentication
        if (isDevelopment)
        {
            // In development, use a more permissive auth handler that supports both Supabase and local
            services.AddAuthentication("DualPath")
                .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, Retroscope.Api.DevelopmentAuthHandler>(
                    "DualPath", options => { });
        }
        else
        {
            // In production, support both Supabase and local JWT validation
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = "MultiScheme";
                options.DefaultChallengeScheme = "MultiScheme";
            })
            .AddPolicyScheme("MultiScheme", "Multi-scheme authentication", options =>
            {
                options.ForwardDefaultSelector = context =>
                {
                    // Check for local auth header
                    var useLocalAuth = context.Request.Headers["X-UseLocalAuth"].FirstOrDefault() == "true";
                    return useLocalAuth ? "LocalAuth" : "SupabaseAuth";
                };
            })
            .AddJwtBearer("LocalAuth", options =>
            {
                var jwtSecret = configuration["JWT:Secret"];
                var jwtIssuer = configuration["JWT:Issuer"];

                if (string.IsNullOrEmpty(jwtSecret))
                {
                    throw new InvalidOperationException("JWT:Secret is required in configuration");
                }

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
            })
            .AddJwtBearer("SupabaseAuth", options =>
            {
                var supabaseUrl = configuration["SUPABASE_URL"];
                var supabaseJwksUrl = configuration["SUPABASE_JWKS_URL"] ?? $"{supabaseUrl}/auth/v1/keys";

                options.Authority = supabaseUrl;
                options.Audience = "authenticated";
                options.RequireHttpsMetadata = false; // Set to true in production with HTTPS
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = supabaseUrl,
                    ValidAudience = "authenticated",
                    IssuerSigningKeyResolver = (token, securityToken, kid, parameters) =>
                    {
                        try
                        {
                            using var httpClient = new HttpClient();
                            var jwksResponse = httpClient.GetStringAsync(supabaseJwksUrl).GetAwaiter().GetResult();
                            var jwks = JsonSerializer.Deserialize<JsonElement>(jwksResponse);

                            if (jwks.TryGetProperty("keys", out var keys))
                            {
                                var securityKeys = new List<SecurityKey>();

                                foreach (var key in keys.EnumerateArray())
                                {
                                    if (key.TryGetProperty("kid", out var keyId) &&
                                        key.TryGetProperty("n", out var modulus) &&
                                        key.TryGetProperty("e", out var exponent))
                                    {
                                        var nBytes = Base64UrlEncoder.DecodeBytes(modulus.GetString()!);
                                        var eBytes = Base64UrlEncoder.DecodeBytes(exponent.GetString()!);

                                        var rsa = System.Security.Cryptography.RSA.Create();
                                        var rsaParams = new System.Security.Cryptography.RSAParameters
                                        {
                                            Modulus = nBytes,
                                            Exponent = eBytes
                                        };
                                        rsa.ImportParameters(rsaParams);

                                        securityKeys.Add(new RsaSecurityKey(rsa));
                                    }
                                }

                                return securityKeys;
                            }
                        }
                        catch (Exception ex)
                        {
                            // Log the error but don't throw - allow other auth schemes to try
                            Console.WriteLine($"Failed to fetch JWKS from {supabaseJwksUrl}: {ex.Message}");
                        }

                        return new List<SecurityKey>();
                    }
                };
            });
        }

        services.AddAuthorization();

        return services;
    }
}
