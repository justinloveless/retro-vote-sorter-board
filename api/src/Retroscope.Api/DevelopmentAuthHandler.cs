using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace Retroscope.Api;

public class DevelopmentAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ISystemClock clock)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder, clock)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var authHeader = Request.Headers["Authorization"].ToString();
        
        // Always provide authentication - create a user with appropriate claims
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, "dev-user"),
            new(ClaimTypes.Name, "dev-user"),
            new("role", "authenticated")
        };

        // If there's a bearer token, use it to determine the user
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
        {
            var token = authHeader.Substring("Bearer ".Length);
            if (!string.IsNullOrWhiteSpace(token))
            {
                // Use the token as the user identifier for development
                claims[0] = new Claim(ClaimTypes.NameIdentifier, $"dev-user-{token}");
                claims[1] = new Claim(ClaimTypes.Name, $"dev-user-{token}");
            }
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}


