package com.trimtime.barber;
import com.trimtime.identity.UserAccount; import com.trimtime.salon.Salon; import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="barber_memberships") public class BarberMembership {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="barber_user_id",nullable=false,unique=true) private UserAccount barber;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="salon_id",nullable=false) private Salon salon;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="approved_by_user_id",nullable=false) private UserAccount approvedBy;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 protected BarberMembership(){}
 public BarberMembership(UserAccount barber,Salon salon,UserAccount approvedBy){this.barber=barber;this.salon=salon;this.approvedBy=approvedBy;}
 public Long getId(){return id;} public UserAccount getBarber(){return barber;} public Salon getSalon(){return salon;}
}
