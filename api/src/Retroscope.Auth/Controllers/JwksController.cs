using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace Retroscope.Auth.Controllers;

[ApiController]
[Route("auth/v1/.well-known")]
public class JwksController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public JwksController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("jwks.json")]
    public IActionResult GetJwks()
    {
        try
        {
            var secret = _configuration["JWT:Secret"];
            if (string.IsNullOrEmpty(secret))
            {
                return StatusCode(500, new { error = "JWT secret not configured" });
            }

            var keyBytes = System.Text.Encoding.UTF8.GetBytes(secret);
            var base64Key = Convert.ToBase64String(keyBytes);

            var jwks = new
            {
                keys = new[]
                {
                    new
                    {
                        kty = "oct",
                        k = base64Key,
                        kid = "default",
                        alg = "HS256",
                        use = "sig"
                    }
                }
            };

            return Ok(jwks);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to generate JWKS" });
        }
    }
}
