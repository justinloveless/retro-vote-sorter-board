using System.ComponentModel.DataAnnotations;

namespace Retroscope.Auth.Models;

public class User
{
    public Guid Id { get; set; }
    
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
    
    public string? EncryptedPassword { get; set; }
    
    public DateTime? EmailConfirmedAt { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? LastSignInAt { get; set; }
    
    public string? RawAppMetaData { get; set; }
    
    public string? RawUserMetaData { get; set; }
    
    // Navigation properties
    public virtual ICollection<Identity> Identities { get; set; } = new List<Identity>();
    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
