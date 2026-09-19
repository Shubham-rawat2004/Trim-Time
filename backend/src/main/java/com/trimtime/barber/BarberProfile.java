package com.trimtime.barber;
import com.trimtime.identity.UserAccount;
import jakarta.persistence.*;
@Entity @Table(name="barber_profiles") public class BarberProfile {
 @Id @Column(name="user_id") private Long userId;
 @OneToOne(fetch=FetchType.LAZY) @JoinColumn(name="user_id", insertable=false, updatable=false) private UserAccount user;
 @Column(length=1000) private String bio;
 @Column(name="experience_years", nullable=false) private int experienceYears;
 protected BarberProfile(){}
 public BarberProfile(UserAccount user,String bio,int experienceYears){this.user=user;this.userId=user.getId();this.bio=bio;this.experienceYears=experienceYears;}
 public UserAccount getUser(){return user;} public String getBio(){return bio;} public int getExperienceYears(){return experienceYears;}
}
