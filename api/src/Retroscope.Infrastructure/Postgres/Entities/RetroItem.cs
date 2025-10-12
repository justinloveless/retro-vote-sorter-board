using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Retroscope.Infrastructure.Postgres.Entities;

[Table("retro_items", Schema = "public")]
public class RetroItem
{
    [Key]
    [Column("id")]
    public Guid Id { get; set; }

    [Required]
    [Column("board_id")]
    public Guid BoardId { get; set; }

    [Required]
    [Column("column_id")]
    public Guid ColumnId { get; set; }

    [Required]
    [Column("content")]
    public string Content { get; set; } = string.Empty;

    [Required]
    [Column("created_by")]
    public Guid CreatedBy { get; set; }

    [Required]
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    [Column("votes")]
    public int? Votes { get; set; }

    [Column("group_id")]
    public Guid? GroupId { get; set; }

    [Column("position")]
    public int? Position { get; set; }

    // Navigation properties
    [ForeignKey("BoardId")]
    public RetroBoard? RetroBoard { get; set; }

    [ForeignKey("ColumnId")]
    public RetroColumn? RetroColumn { get; set; }
}

