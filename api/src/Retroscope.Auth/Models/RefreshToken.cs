using System.ComponentModel.DataAnnotations;

namespace Retroscope.Auth.Models;

public class RefreshToken
{
    public Guid Id { get; set; }
    
    [Required]
    public string Token { get; set; } = string.Empty;
    
    public Guid UserId { get; set; }
    
    public string? Parent { get; set; }
    
    public bool Revoked { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation property
    public virtual User User { get; set; } = null!;
}
