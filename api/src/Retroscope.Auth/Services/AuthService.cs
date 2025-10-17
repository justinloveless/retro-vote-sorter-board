using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Retroscope.Auth.Data;
using Retroscope.Auth.DTOs;
using Retroscope.Auth.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Retroscope.Auth.Services;

public class AuthService : IAuthService
{
    private readonly AuthDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;
    private readonly HttpClient _httpClient;

    public AuthService(
        AuthDbContext context,
        IConfiguration configuration,
        ILogger<AuthService> logger,
        HttpClient httpClient)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<AuthResponse> SignUpAsync(SignUpRequest request)
    {
        // Check if user already exists
        var existingUser = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email);
        
        if (existingUser != null)
        {
            throw new InvalidOperationException("User with this email already exists");
        }

        // Hash password
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // Create user
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            EncryptedPassword = passwordHash,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Generate tokens
        var tokens = await GenerateTokensAsync(user);

        return new AuthResponse
        {
            AccessToken = tokens.AccessToken,
            RefreshToken = tokens.RefreshToken,
            User = MapToUserResponse(user)
        };
    }

    public async Task<AuthResponse> SignInWithPasswordAsync(SignInRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null || user.EncryptedPassword == null)
        {
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.EncryptedPassword))
        {
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        // Update last sign in
        user.LastSignInAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Generate tokens
        var tokens = await GenerateTokensAsync(user);

        return new AuthResponse
        {
            AccessToken = tokens.AccessToken,
            RefreshToken = tokens.RefreshToken,
            User = MapToUserResponse(user)
        };
    }

    public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request)
    {
        var refreshToken = await _context.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken && !rt.Revoked);

        if (refreshToken == null || refreshToken.User == null)
        {
            throw new UnauthorizedAccessException("Invalid refresh token");
        }

        // Revoke the old refresh token
        refreshToken.Revoked = true;
        refreshToken.UpdatedAt = DateTime.UtcNow;

        // Generate new tokens
        var tokens = await GenerateTokensAsync(refreshToken.User);

        return new AuthResponse
        {
            AccessToken = tokens.AccessToken,
            RefreshToken = tokens.RefreshToken,
            User = MapToUserResponse(refreshToken.User)
        };
    }

    public async Task<UserResponse> GetUserAsync(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        
        if (user == null)
        {
            throw new KeyNotFoundException("User not found");
        }

        return MapToUserResponse(user);
    }

    public async Task<string> GetOAuthUrlAsync(string provider, string? redirectTo = null)
    {
        var state = Guid.NewGuid().ToString();
        
        return provider.ToLower() switch
        {
            "github" => $"https://github.com/login/oauth/authorize?" +
                       $"client_id={_configuration["OAuth:GitHub:ClientId"]}&" +
                       $"redirect_uri={_configuration["OAuth:GitHub:RedirectUri"]}&" +
                       $"scope=user:email&state={state}",
            
            "google" => $"https://accounts.google.com/o/oauth2/v2/auth?" +
                       $"client_id={_configuration["OAuth:Google:ClientId"]}&" +
                       $"redirect_uri={_configuration["OAuth:Google:RedirectUri"]}&" +
                       $"response_type=code&scope=openid%20email%20profile&" +
                       $"state={state}",
            
            _ => throw new ArgumentException($"Unsupported provider: {provider}")
        };
    }

    public async Task<OAuthCallbackResponse> HandleOAuthCallbackAsync(string provider, OAuthCallbackRequest request)
    {
        var userInfo = await GetUserInfoFromProviderAsync(provider, request.Code);
        
        // Check if user exists by email
        var user = await _context.Users
            .Include(u => u.Identities)
            .FirstOrDefaultAsync(u => u.Email == userInfo.Email);

        if (user == null)
        {
            // Create new user
            user = new User
            {
                Id = Guid.NewGuid(),
                Email = userInfo.Email,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                LastSignInAt = DateTime.UtcNow,
                RawUserMetaData = JsonSerializer.Serialize(userInfo.Metadata)
            };
            _context.Users.Add(user);
        }
        else
        {
            // Update existing user
            user.LastSignInAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
        }

        // Check if identity exists
        var identity = user.Identities
            .FirstOrDefault(i => i.Provider == provider && i.ProviderUserId == userInfo.ProviderUserId);

        if (identity == null)
        {
            identity = new Identity
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Provider = provider,
                ProviderUserId = userInfo.ProviderUserId,
                ProviderData = JsonSerializer.Serialize(userInfo.Metadata),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Identities.Add(identity);
        }
        else
        {
            identity.ProviderData = JsonSerializer.Serialize(userInfo.Metadata);
            identity.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        // Generate tokens
        var tokens = await GenerateTokensAsync(user);

        return new OAuthCallbackResponse
        {
            AccessToken = tokens.AccessToken,
            RefreshToken = tokens.RefreshToken,
            RedirectUrl = request.State ?? "/"
        };
    }

    public async Task<bool> VerifyEmailAsync(string code)
    {
        var verificationCode = await _context.VerificationCodes
            .Include(vc => vc.User)
            .FirstOrDefaultAsync(vc => vc.Code == code && 
                                      vc.Type == "email_verification" && 
                                      vc.UsedAt == null && 
                                      vc.ExpiresAt > DateTime.UtcNow);

        if (verificationCode == null)
        {
            return false;
        }

        verificationCode.User.EmailConfirmedAt = DateTime.UtcNow;
        verificationCode.UsedAt = DateTime.UtcNow;
        verificationCode.User.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ResetPasswordAsync(string email)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
        {
            return false; // Don't reveal if email exists
        }

        var code = GenerateVerificationCode();
        var verificationCode = new VerificationCode
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Code = code,
            Type = "password_reset",
            ExpiresAt = DateTime.UtcNow.AddHours(1),
            CreatedAt = DateTime.UtcNow
        };

        _context.VerificationCodes.Add(verificationCode);
        await _context.SaveChangesAsync();

        // TODO: Send email with reset code
        _logger.LogInformation($"Password reset code for {email}: {code}");

        return true;
    }

    public async Task<bool> ConfirmPasswordResetAsync(string code, string newPassword)
    {
        var verificationCode = await _context.VerificationCodes
            .Include(vc => vc.User)
            .FirstOrDefaultAsync(vc => vc.Code == code && 
                                      vc.Type == "password_reset" && 
                                      vc.UsedAt == null && 
                                      vc.ExpiresAt > DateTime.UtcNow);

        if (verificationCode == null)
        {
            return false;
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        verificationCode.User.EncryptedPassword = passwordHash;
        verificationCode.User.UpdatedAt = DateTime.UtcNow;
        verificationCode.UsedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<(string AccessToken, string RefreshToken)> GenerateTokensAsync(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("role", "authenticated"),
            new Claim("aud", "authenticated")
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["JWT:Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["JWT:Issuer"],
            audience: "authenticated",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = GenerateRefreshToken();

        // Store refresh token
        var refreshTokenEntity = new RefreshToken
        {
            Id = Guid.NewGuid(),
            Token = refreshToken,
            UserId = user.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync();

        return (accessToken, refreshToken);
    }

    private string GenerateRefreshToken()
    {
        var randomBytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    private string GenerateVerificationCode()
    {
        var random = new Random();
        return random.Next(100000, 999999).ToString();
    }

    private UserResponse MapToUserResponse(User user)
    {
        return new UserResponse
        {
            Id = user.Id,
            Email = user.Email,
            EmailConfirmedAt = user.EmailConfirmedAt,
            CreatedAt = user.CreatedAt,
            UpdatedAt = user.UpdatedAt,
            LastSignInAt = user.LastSignInAt,
            RawAppMetaData = user.RawAppMetaData,
            RawUserMetaData = user.RawUserMetaData
        };
    }

    private async Task<(string Email, string ProviderUserId, object Metadata)> GetUserInfoFromProviderAsync(string provider, string code)
    {
        return provider.ToLower() switch
        {
            "github" => await GetGitHubUserInfoAsync(code),
            "google" => await GetGoogleUserInfoAsync(code),
            _ => throw new ArgumentException($"Unsupported provider: {provider}")
        };
    }

    private async Task<(string Email, string ProviderUserId, object Metadata)> GetGitHubUserInfoAsync(string code)
    {
        // Exchange code for access token
        var tokenRequest = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", _configuration["OAuth:GitHub:ClientId"]!),
            new KeyValuePair<string, string>("client_secret", _configuration["OAuth:GitHub:ClientSecret"]!),
            new KeyValuePair<string, string>("code", code)
        });

        var tokenResponse = await _httpClient.PostAsync("https://github.com/login/oauth/access_token", tokenRequest);
        var tokenContent = await tokenResponse.Content.ReadAsStringAsync();
        var tokenData = System.Web.HttpUtility.ParseQueryString(tokenContent);
        var accessToken = tokenData["access_token"];

        if (string.IsNullOrEmpty(accessToken))
        {
            throw new UnauthorizedAccessException("Failed to get GitHub access token");
        }

        // Get user info
        _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var userResponse = await _httpClient.GetAsync("https://api.github.com/user");
        var userJson = await userResponse.Content.ReadAsStringAsync();
        var userData = JsonSerializer.Deserialize<JsonElement>(userJson);

        return (
            userData.GetProperty("email").GetString() ?? throw new InvalidOperationException("No email from GitHub"),
            userData.GetProperty("id").ToString(),
            new { name = userData.GetProperty("name").GetString(), avatar_url = userData.GetProperty("avatar_url").GetString() }
        );
    }

    private async Task<(string Email, string ProviderUserId, object Metadata)> GetGoogleUserInfoAsync(string code)
    {
        // Exchange code for access token
        var tokenRequest = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("client_id", _configuration["OAuth:Google:ClientId"]!),
            new KeyValuePair<string, string>("client_secret", _configuration["OAuth:Google:ClientSecret"]!),
            new KeyValuePair<string, string>("code", code),
            new KeyValuePair<string, string>("grant_type", "authorization_code"),
            new KeyValuePair<string, string>("redirect_uri", _configuration["OAuth:Google:RedirectUri"]!)
        });

        var tokenResponse = await _httpClient.PostAsync("https://oauth2.googleapis.com/token", tokenRequest);
        var tokenJson = await tokenResponse.Content.ReadAsStringAsync();
        var tokenData = JsonSerializer.Deserialize<JsonElement>(tokenJson);
        var accessToken = tokenData.GetProperty("access_token").GetString();

        if (string.IsNullOrEmpty(accessToken))
        {
            throw new UnauthorizedAccessException("Failed to get Google access token");
        }

        // Get user info
        var userResponse = await _httpClient.GetAsync($"https://www.googleapis.com/oauth2/v2/userinfo?access_token={accessToken}");
        var userJson = await userResponse.Content.ReadAsStringAsync();
        var userData = JsonSerializer.Deserialize<JsonElement>(userJson);

        return (
            userData.GetProperty("email").GetString() ?? throw new InvalidOperationException("No email from Google"),
            userData.GetProperty("id").GetString() ?? throw new InvalidOperationException("No ID from Google"),
            new { name = userData.GetProperty("name").GetString(), picture = userData.GetProperty("picture").GetString() }
        );
    }
}
