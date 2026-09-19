package com.trimtime.barber;
import com.trimtime.identity.UserAccount; import com.trimtime.salon.Salon; import jakarta.persistence.*; import java.time.Instant;
@Entity @Table(name="barber_join_requests") public class BarberJoinRequest {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="barber_user_id",nullable=false) private UserAccount barber;
 @ManyToOne(fetch=FetchType.EAGER) @JoinColumn(name="salon_id",nullable=false) private Salon salon;
 @Column(length=1000) private String message;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=24) private BarberStatus status=BarberStatus.PENDING;
 @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
 @Column(name="decided_at") private Instant decidedAt;
 protected BarberJoinRequest(){}
 public BarberJoinRequest(UserAccount barber,Salon salon,String message){this.barber=barber;this.salon=salon;this.message=message;}
 public Long getId(){return id;} public UserAccount getBarber(){return barber;} public Salon getSalon(){return salon;} public String getMessage(){return message;} public BarberStatus getStatus(){return status;} public Instant getCreatedAt(){return createdAt;}
 public void decide(BarberStatus next){this.status=next;this.decidedAt=Instant.now();}
}
